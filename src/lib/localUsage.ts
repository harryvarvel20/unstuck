import { ANON_DAILY_LIMIT } from "./constants";

const KEY = "adhv-usage";

interface UsageRecord {
  date: string; // YYYY-MM-DD
  count: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function read(): UsageRecord {
  if (typeof window === "undefined") return { date: today(), count: 0 };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { date: today(), count: 0 };
    const parsed = JSON.parse(raw) as UsageRecord;
    if (parsed.date !== today()) return { date: today(), count: 0 };
    return { date: parsed.date, count: parsed.count };
  } catch {
    return { date: today(), count: 0 };
  }
}

function write(rec: UsageRecord): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rec));
  } catch {
    /* storage unavailable — no-op */
  }
}

export function getLocalUsageCount(): number {
  return read().count;
}

export function localRemaining(): number {
  return Math.max(0, ANON_DAILY_LIMIT - read().count);
}

export function incrementLocalUsage(): number {
  const rec = read();
  const next = { date: rec.date, count: rec.count + 1 };
  write(next);
  return next.count;
}

export const DAILY_LIMIT = ANON_DAILY_LIMIT;
