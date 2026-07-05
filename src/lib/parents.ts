/**
 * Parents Mode foundation (Phase W). Age band drives content, tone, visuals
 * and which tools appear across every Parents-Mode surface. The band config
 * here is the single source later sub-phases (schedules, rewards, coaching)
 * read from, so the app stays coherent as it adapts by age.
 */

export type AgeBand = "4-7" | "8-12" | "13-17";

export const AGE_BANDS: {
  id: AgeBand;
  label: string;
  blurb: string;
}[] = [
  {
    id: "4-7",
    label: "4–7",
    blurb:
      "Picture-led schedules, sticker & first–then boards, big simple visuals.",
  },
  {
    id: "8-12",
    label: "8–12",
    blurb: "Token economy, checklists, emotion coaching, homework broken down.",
  },
  {
    id: "13-17",
    label: "13–17",
    blurb:
      "Autonomy & motivation, problem-solving together, self-advocacy — the teen owns it.",
  },
];

export interface BandConfig {
  /** How earning is expressed at this age. */
  rewardCurrency: "stickers" | "points" | "privileges";
  /** How schedules are presented. */
  scheduleStyle: "pictures" | "checklist" | "self-owned";
  /** One-line tone guide for AI + copy. */
  tone: string;
  /** How reward mechanics are framed (never punitive; teens self-own). */
  rewardFraming: string;
}

export const BAND_CONFIG: Record<AgeBand, BandConfig> = {
  "4-7": {
    rewardCurrency: "stickers",
    scheduleStyle: "pictures",
    tone: "Warm, playful, very concrete. Short words. Celebrate everything.",
    rewardFraming: "Stickers earned — always adding, never taken away.",
  },
  "8-12": {
    rewardCurrency: "points",
    scheduleStyle: "checklist",
    tone: "Encouraging and matter-of-fact. Coach feelings; make plans visible.",
    rewardFraming: "Points earned toward a menu the child helped choose.",
  },
  "13-17": {
    rewardCurrency: "privileges",
    scheduleStyle: "self-owned",
    tone: "Respectful, autonomy-supporting, collaborative. Never controlling.",
    rewardFraming:
      "Self-tracking the teen owns — agreed privileges, not a reward chart.",
  },
};

export function bandConfig(band: AgeBand): BandConfig {
  return BAND_CONFIG[band];
}

export function isAgeBand(x: unknown): x is AgeBand {
  return x === "4-7" || x === "8-12" || x === "13-17";
}

export function bandLabel(band: AgeBand): string {
  return AGE_BANDS.find((b) => b.id === band)?.label ?? band;
}

export interface Child {
  id: string;
  name: string | null;
  ageBand: AgeBand;
  hardest: string | null;
  createdAt: string;
}

/** On every Parents-Mode surface (entry + every emotional/behavioural flow). */
export const PARENTS_DISCLAIMER =
  "ADHV Parents is a self-management and skills tool — not therapy, diagnosis, or medical advice.";

/** The reframe that runs through everything: behaviour = lagging skill, not defiance. */
export const PARENTS_ETHOS = "Kids do well if they can.";
