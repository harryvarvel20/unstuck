import { NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const schema = z.object({
  kind: z.enum(["note", "parked", "draft"]).default("note"),
  content: z.string().trim().min(1).max(4000),
});

/**
 * POST /api/journal — park a thought or a draft-that-is-never-sent. The app
 * cannot send messages anywhere; this only ever writes to the private journal.
 */
export async function POST(req: NextRequest): Promise<Response> {
  const supabase = await createSupabaseServer();
  if (!supabase) return json({ error: "unavailable" }, 503);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return json({ error: "invalid_input" }, 400);

  const { error } = await supabase.from("journal").insert({
    user_id: user.id,
    kind: parsed.data.kind,
    content: parsed.data.content,
  });
  if (error) {
    console.error("journal insert failed:", error.message);
    return json({ error: "save_failed" }, 500);
  }
  return json({ ok: true }, 201);
}
