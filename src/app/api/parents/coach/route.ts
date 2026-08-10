import { NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getServiceClient } from "@/lib/supabaseServer";
import {
  getGemini,
  BREAKDOWN_MODEL,
  buildParentPlanPrompt,
  buildParentReframePrompt,
  buildParentHomeworkPrompt,
  buildCpsPrompt,
  buildSchoolDraftPrompt,
} from "@/lib/gemini";
import { BAND_CONFIG, isAgeBand, type AgeBand } from "@/lib/parents";
import { childSafetyConcern, CHILD_SAFETY_SIGNPOST } from "@/lib/safety";
import { sanitizeText } from "@/lib/parseBreakdown";
import {
  checkBurst,
  consumeFeature,
  BURST,
  LIMITS,
  type RequestIdentity,
} from "@/lib/quota";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const schema = z.object({
  kind: z.enum(["plan", "reframe", "homework", "cps", "school"]),
  ageBand: z.string().optional(),
  text: z.string().trim().max(1000).optional().default(""),
  detail: z.string().trim().max(1000).optional().default(""),
  step: z.number().int().min(1).max(3).optional(),
});

async function generate(system: string, user: string): Promise<unknown> {
  const ai = getGemini();
  const res = await ai.models.generateContent({
    model: BREAKDOWN_MODEL,
    contents: user,
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      maxOutputTokens: 1400,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  return JSON.parse(res.text ?? "{}");
}

/** POST /api/parents/coach — Parents-Mode AI flows. Pro-gated, safeguarded. */
export async function POST(req: NextRequest): Promise<Response> {
  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .maybeSingle();
  const plan: "free" | "pro" = profile?.plan === "pro" ? "pro" : "free";
  if (plan !== "pro") return json({ error: "pro_required" }, 402);

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "invalid" }, 400);
  const { kind, text, detail, step } = parsed.data;
  const band: AgeBand = isAgeBand(parsed.data.ageBand)
    ? parsed.data.ageBand
    : "8-12";
  const bandTone = BAND_CONFIG[band].tone;

  // Safeguarding on every free-text input — free, deterministic, first.
  if (childSafetyConcern(`${text} ${detail}`)) {
    return json({ childSafety: true, message: CHILD_SAFETY_SIGNPOST });
  }

  // Rate limits (burst + daily light-AI), even for Pro.
  const identity: RequestIdentity = {
    user: { id: user.id, email: null },
    plan,
    subject: `user:${user.id}`,
    supabase: getServiceClient(),
  };
  if (!(await checkBurst(identity, "aiLight", BURST.aiLight))) {
    return json({ error: "rate_limited" }, 429);
  }
  const quota = await consumeFeature(
    identity,
    "ai_light",
    LIMITS.aiLightPerDay,
  );
  if (!quota.allowed) return json({ error: "limit_reached" }, 429);

  const clean = sanitizeText(text);
  const cleanDetail = sanitizeText(detail);

  try {
    let out: Record<string, unknown>;
    if (kind === "plan") {
      out = (await generate(
        buildParentPlanPrompt(bandTone),
        `Situation: ${clean}${cleanDetail ? `\nDetail: ${cleanDetail}` : ""}`,
      )) as Record<string, unknown>;
    } else if (kind === "reframe") {
      out = (await generate(
        buildParentReframePrompt(bandTone),
        `Behaviour: ${clean}`,
      )) as Record<string, unknown>;
    } else if (kind === "homework") {
      out = (await generate(
        buildParentHomeworkPrompt(bandTone),
        `Homework: ${clean}`,
      )) as Record<string, unknown>;
    } else if (kind === "cps") {
      out = (await generate(
        buildCpsPrompt(bandTone),
        `Step ${step ?? 1} of Plan B. Concern: ${clean}`,
      )) as Record<string, unknown>;
    } else {
      out = (await generate(
        buildSchoolDraftPrompt(),
        `Request: ${clean}${cleanDetail ? `\nTone/notes: ${cleanDetail}` : ""}`,
      )) as Record<string, unknown>;
    }

    if (out && out.crisis) {
      return json({ childSafety: true, message: CHILD_SAFETY_SIGNPOST });
    }
    return json({ ok: true, result: out });
  } catch {
    return json({ error: "failed" }, 502);
  }
}
