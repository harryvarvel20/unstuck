/**
 * Parents Mode — DEVICE-ONLY store (Phase Y follow-up).
 *
 * Deliberate privacy design: ADHV holds NO data about a child on its servers.
 * Everything a parent sets up for their child — the child list (an optional
 * nickname + age band), the reward chart, and the "wins about my kid" log —
 * lives only in this browser's localStorage. It is never sent to or stored by
 * ADHV. The AI coaching flows still work because they take the age band + the
 * parent's free-text situation as a throwaway request parameter and store
 * nothing. Parents Mode is a shared-screen tool used on one device, so on-device
 * state fits it naturally — and it means there is simply no children's personal
 * data for us to hold, disclose, or lose.
 */

import type { AgeBand, Child } from "./parents";

const CHILDREN_KEY = "adhv-parents-children";
const WINS_KEY = "adhv-parents-wins";
const rewardKey = (childId: string) => `adhv-parents-reward-${childId}`;

function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full / disabled — nothing we can or should escalate */
  }
}

/* ---- children ---------------------------------------------------------- */

export function loadChildren(): Child[] {
  return read<Child[]>(CHILDREN_KEY, []);
}

export function addChildLocal(input: {
  name?: string;
  ageBand: AgeBand;
  hardest?: string;
}): Child {
  const child: Child = {
    id: uuid(),
    name: input.name?.trim() || null,
    ageBand: input.ageBand,
    hardest: input.hardest?.trim() || null,
    createdAt: new Date().toISOString(),
  };
  write(CHILDREN_KEY, [...loadChildren(), child]);
  return child;
}

export function removeChildLocal(id: string): void {
  write(
    CHILDREN_KEY,
    loadChildren().filter((c) => c.id !== id),
  );
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(rewardKey(id));
    } catch {
      /* noop */
    }
  }
  write(
    WINS_KEY,
    loadWins().filter((w) => w.childId !== id),
  );
}

/* ---- reward chart ------------------------------------------------------- */

export interface RewardState {
  behaviours: string[];
  rewards: string[];
  tokens: number;
}

export function loadReward(childId: string): RewardState {
  return read<RewardState>(rewardKey(childId), {
    behaviours: [],
    rewards: [],
    tokens: 0,
  });
}

export function saveReward(
  childId: string,
  data: { behaviours: string[]; rewards: string[] },
): void {
  const cur = loadReward(childId);
  write(rewardKey(childId), {
    ...cur,
    behaviours: data.behaviours,
    rewards: data.rewards,
  });
}

/** Earning only — a token is never taken away. */
export function earnToken(childId: string): number {
  const cur = loadReward(childId);
  const tokens = cur.tokens + 1;
  write(rewardKey(childId), { ...cur, tokens });
  return tokens;
}

/* ---- "wins about my kid" ----------------------------------------------- */

export interface LocalWin {
  id: string;
  childId: string | null;
  text: string;
  created_at: string;
}

export function loadWins(): LocalWin[] {
  return read<LocalWin[]>(WINS_KEY, []);
}

export function addWinLocal(childId: string | null, text: string): LocalWin {
  const win: LocalWin = {
    id: uuid(),
    childId,
    text,
    created_at: new Date().toISOString(),
  };
  write(WINS_KEY, [win, ...loadWins()].slice(0, 200));
  return win;
}

export function removeWinLocal(id: string): void {
  write(
    WINS_KEY,
    loadWins().filter((w) => w.id !== id),
  );
}

/* ---- one-tap erase -------------------------------------------------------
   Removes EVERYTHING Parents-related from this device: the child list, every
   reward chart, the wins log, and the active-child pointer. Called from the
   Parents screen (erase button), on sign-out, and on account deletion. */

export function clearAllParentsLocal(): void {
  if (typeof window === "undefined") return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && (k.startsWith("adhv-parents-") || k === "adhv-active-child")) {
        doomed.push(k);
      }
    }
    doomed.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* storage unavailable — nothing to clear */
  }
}
