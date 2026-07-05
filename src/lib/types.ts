export interface BreakdownStep {
  title: string;
  minutes: number;
  tip?: string;
}

/** Shape the model is asked to produce (single JSON object). */
export interface BreakdownResult {
  crisis: false;
  total_minutes: number;
  steps: BreakdownStep[];
}

export interface CrisisResult {
  crisis: true;
  message: string;
}

export type ModelOutput = BreakdownResult | CrisisResult;

/** Incrementally-parsed view of the stream, used while tokens arrive. */
export interface PartialBreakdown {
  crisis: boolean;
  crisisMessage: string | null;
  totalMinutes: number | null;
  steps: BreakdownStep[];
}

export interface SessionUser {
  id: string;
  email: string | null;
}

/** A saved task, hydrated into the breakdown screen. */
export interface TaskRecord {
  id: string;
  input_text: string;
  steps: BreakdownStep[];
  completed_steps: boolean[];
  created_at?: string;
}
