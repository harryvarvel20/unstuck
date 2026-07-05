import { parseStreamingBreakdown } from "./parseBreakdown";
import type { PartialBreakdown } from "./types";

export type BreakdownMode = "normal" | "smaller" | "subtask" | "rescue";

export class LimitReachedError extends Error {
  constructor() {
    super("limit_reached");
    this.name = "LimitReachedError";
  }
}

export class BreakdownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BreakdownError";
  }
}

/**
 * Generic streamed-POST helper: sends JSON, streams the text response, and
 * invokes onChunk with the accumulated buffer after every chunk. Resolves
 * with the final buffer; throws LimitReachedError on 429 and BreakdownError
 * on network/server trouble. A `proRequired` flag distinguishes Pro gates.
 */
export class ProRequiredError extends Error {
  constructor() {
    super("pro_required");
    this.name = "ProRequiredError";
  }
}

export async function streamPost(
  endpoint: string,
  body: unknown,
  onChunk: (buffer: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new BreakdownError("network");
  }

  if (res.status === 429) throw new LimitReachedError();
  if (res.status === 402) throw new ProRequiredError();
  if (!res.ok || !res.body) throw new BreakdownError("server");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    onChunk(buffer);
  }
  buffer += decoder.decode();
  onChunk(buffer);
  return buffer;
}

interface StreamArgs {
  input: string;
  mode: BreakdownMode;
  signal?: AbortSignal;
  onUpdate: (partial: PartialBreakdown) => void;
  /** Defaults to /api/breakdown; the focus rescue endpoint reuses this. */
  endpoint?: string;
}

/**
 * Calls a breakdown-shaped endpoint and streams the response, invoking
 * onUpdate with the incrementally-parsed breakdown as tokens arrive.
 */
export async function streamBreakdown({
  input,
  mode,
  signal,
  onUpdate,
  endpoint = "/api/breakdown",
}: StreamArgs): Promise<PartialBreakdown> {
  let last: PartialBreakdown = {
    crisis: false,
    crisisMessage: null,
    totalMinutes: null,
    steps: [],
  };
  await streamPost(
    endpoint,
    { input, mode },
    (buffer) => {
      last = parseStreamingBreakdown(buffer);
      onUpdate(last);
    },
    signal,
  );
  return last;
}
