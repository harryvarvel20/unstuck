import { NextRequest } from "next/server";
import { z } from "zod";
import {
  BREAKDOWN_MODEL,
  getGemini,
  buildNavigatorPrompt,
  NAV_DESTINATIONS,
  type NavSlug,
} from "@/lib/gemini";
import {
  getRequestIdentity,
  consumeFeature,
  checkBurst,
  LIMITS,
  BURST,
} from "@/lib/quota";
import {
  containsCrisisLanguage,
  childSafetyConcern,
  CRISIS_SIGNPOST,
  CHILD_SAFETY_SIGNPOST,
} from "@/lib/safety";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const schema = z.object({
  query: z.string().trim().min(1).max(300),
});

// slug -> real route, built once from the shared catalog so the client can
// never be sent to a path we didn't sanction.
const ROUTE_BY_SLUG = new Map<NavSlug, string>(
  NAV_DESTINATIONS.map((d) => [d.slug, d.path]),
);
const SLUGS = NAV_DESTINATIONS.map((d) => d.slug) as [NavSlug, ...NavSlug[]];

const modelSchema = z.object({
  crisis: z.boolean().optional(),
  message: z.string().optional(),
  slug: z.enum(SLUGS).optional(),
  task: z.string().optional(),
  reason: z.string().optional(),
});

/**
 * POST /api/navigate — the Navigator. Free-text intent in, a validated
 * in-app route out. Crisis/child-safety is screened deterministically BEFORE
 * any AI call and is never gated. Non-streaming: the client needs one JSON
 * decision, not a token stream.
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

  const query = parsed.data.query;

  // Safety gate first — always free, never routed to a task list. Self-crisis
  // takes precedence (Samaritans); otherwise a child-safeguarding worry.
  if (containsCrisisLanguage(query)) {
    return json({ crisis: true, message: CRISIS_SIGNPOST }, 200);
  }
  if (childSafetyConcern(query)) {
    return json({ crisis: true, message: CHILD_SAFETY_SIGNPOST }, 200);
  }

  const identity = await getRequestIdentity(req);
  if (!(await checkBurst(identity, "aiLight", BURST.aiLight))) {
    return json({ error: "rate_limited" }, 429);
  }
  const cap = await consumeFeature(identity, "ai_light", LIMITS.aiLightPerDay);
  if (!cap.allowed) return json({ error: "limit_reached" }, 429);

  let raw: string;
  try {
    const ai = getGemini();
    const res = await ai.models.generateContent({
      model: BREAKDOWN_MODEL,
      contents: `Where should I go? Here's what I want to solve:\n\n${query}`,
      config: {
        systemInstruction: buildNavigatorPrompt(),
        responseMimeType: "application/json",
        maxOutputTokens: 256,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    raw = res.text ?? "";
  } catch (err) {
    console.error("navigate generate failed:", err);
    return json({ error: "server_error" }, 500);
  }

  let decision: z.infer<typeof modelSchema>;
  try {
    decision = modelSchema.parse(JSON.parse(raw));
  } catch {
    // If the model returned something unparseable, fail soft to the toolkit.
    return json(
      { route: "/toolkit", reason: "Here's everything — pick what fits." },
      200,
    );
  }

  // Model-side crisis backstop (the deterministic gate above is the primary).
  if (decision.crisis) {
    return json(
      { crisis: true, message: decision.message ?? CRISIS_SIGNPOST },
      200,
    );
  }

  const slug: NavSlug = decision.slug ?? "toolkit";
  const path = ROUTE_BY_SLUG.get(slug) ?? "/toolkit";

  // Breakdown is the one destination that can carry the task text through so
  // the composer opens pre-filled.
  let route = path;
  const task = decision.task?.trim();
  if (slug === "breakdown" && task) {
    route = `/app?intent=${encodeURIComponent(task.slice(0, 300))}`;
  }

  return json({ route, reason: decision.reason?.trim() || undefined }, 200);
}
