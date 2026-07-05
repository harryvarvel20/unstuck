import { NextRequest } from "next/server";
import { z } from "zod";
import {
  getSocialContext,
  requirePro,
  jsonError,
  json,
} from "@/lib/socialServer";
import {
  getGemini,
  BREAKDOWN_MODEL,
  buildToneGuardPrompt,
  buildPlaybookDraftPrompt,
} from "@/lib/gemini";
import {
  consumeFeature,
  checkBurst,
  LIMITS,
  BURST,
  type RequestIdentity,
} from "@/lib/quota";
import { sanitizeText } from "@/lib/parseBreakdown";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const toneSchema = z.object({
  kind: z.literal("toneguard"),
  text: z.string().trim().min(1).max(400),
});
const draftSchema = z.object({
  kind: z.literal("playbook"),
  title: z.string().trim().min(1).max(300),
  steps: z.array(z.string().trim().min(1).max(200)).max(12).default([]),
});

async function generateJson(system: string, user: string): Promise<unknown> {
  const ai = getGemini();
  const res = await ai.models.generateContent({
    model: BREAKDOWN_MODEL,
    contents: user,
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  return JSON.parse(res.text ?? "{}");
}

/**
 * POST /api/social/assist — small AI helpers for the Activity Center:
 *  - toneguard: is this comment kind? (nudge only — never a hard block)
 *  - playbook: draft a shareable playbook from a task the user picked
 * Both fail OPEN (kind:true / manual playbook) so AI trouble never blocks
 * a human being supportive.
 */
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const ctx = await getSocialContext();
    requirePro(ctx);
    const body = await req.json().catch(() => ({}));

    const identity: RequestIdentity = {
      user: { id: ctx.userId, email: null },
      plan: ctx.plan,
      subject: `user:${ctx.userId}`,
      supabase: null,
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

    const tone = toneSchema.safeParse(body);
    if (tone.success) {
      try {
        const out = (await generateJson(
          buildToneGuardPrompt(),
          sanitizeText(tone.data.text),
        )) as { kind?: boolean; nudge?: string };
        return json({
          kind: out.kind !== false,
          nudge: out.kind === false ? sanitizeText(out.nudge ?? "") : "",
        });
      } catch {
        return json({ kind: true, nudge: "" }); // fail open
      }
    }

    const draft = draftSchema.safeParse(body);
    if (draft.success) {
      try {
        const user = `Task: ${sanitizeText(draft.data.title)}\nSteps used:\n${draft.data.steps.map((s) => `- ${sanitizeText(s)}`).join("\n")}`;
        const out = (await generateJson(buildPlaybookDraftPrompt(), user)) as {
          steps?: { title?: string; minutes?: number }[];
          whatWorked?: string;
        };
        const steps = (out.steps ?? [])
          .filter((s) => s.title)
          .slice(0, 12)
          .map((s) => ({
            title: sanitizeText(String(s.title)).slice(0, 200),
            minutes: Math.min(
              240,
              Math.max(1, Math.round(Number(s.minutes) || 5)),
            ),
          }));
        if (steps.length === 0) return json({ error: "empty" }, 502);
        return json({
          steps,
          whatWorked: sanitizeText(out.whatWorked ?? "").slice(0, 400),
        });
      } catch {
        return json({ error: "failed" }, 502);
      }
    }

    return json({ error: "invalid" }, 400);
  } catch (err) {
    return jsonError(err);
  }
}
