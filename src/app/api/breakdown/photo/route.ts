import { NextRequest } from "next/server";
import { z } from "zod";
import { buildPhotoPrompt, buildPhotoUserContent } from "@/lib/gemini";
import { streamGeminiJson } from "@/lib/geminiStream";
import { consumeAnonQuota, consumeUserQuota } from "@/lib/rateLimit";
import { getRequestIdentity, checkBurst, BURST } from "@/lib/quota";
import { getServiceClient } from "@/lib/supabaseServer";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const schema = z.object({
  // Base64 JPEG (no data: prefix). ~1.4MB base64 ceiling (~1MB image).
  image: z.string().min(16).max(1_800_000),
  note: z.string().trim().max(500).optional().default(""),
});

/**
 * POST /api/breakdown/photo — vision breakdown. Counts toward the same daily
 * breakdown allowance (Pro unlimited). Burst-limited. The photo itself is
 * persisted (or not) client-side; this route only reads pixels to plan.
 */
export async function POST(req: NextRequest): Promise<Response> {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return json({ error: "invalid_input" }, 400);

  const identity = await getRequestIdentity(req);
  if (!(await checkBurst(identity, "breakdown", BURST.breakdown))) {
    return json({ error: "rate_limited" }, 429);
  }

  if (identity.plan !== "pro") {
    const quota = identity.user
      ? await consumeUserQuota(identity.user.id)
      : await consumeAnonQuota(identity.subject.replace(/^ip:/, ""));
    if (!quota.allowed) {
      return json(
        {
          error: "limit_reached",
          message: "You've used your free breakdowns for today.",
        },
        429,
      );
    }
  }

  // Persist the photo under the user's own folder (signed-in only; anonymous
  // photos are never stored). Best-effort — a storage hiccup never blocks the
  // plan. EXIF was already stripped client-side.
  if (identity.user) {
    const service = getServiceClient();
    if (service) {
      try {
        const bytes = Buffer.from(parsed.data.image, "base64");
        await service.storage
          .from("task-photos")
          .upload(`${identity.user.id}/${randomUUID()}.jpg`, bytes, {
            contentType: "image/jpeg",
            upsert: false,
          });
      } catch (err) {
        console.error("photo upload failed:", err);
      }
    }
  }

  try {
    return streamGeminiJson({
      system: buildPhotoPrompt(),
      user: buildPhotoUserContent(parsed.data.note),
      image: { base64: parsed.data.image, mimeType: "image/jpeg" },
      maxTokens: 2048,
    });
  } catch {
    return json({ error: "server_config" }, 500);
  }
}
