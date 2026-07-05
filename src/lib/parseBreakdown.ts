import type { BreakdownStep, PartialBreakdown } from "./types";

/**
 * Incrementally parse a partially-streamed JSON breakdown.
 *
 * The model streams a single JSON object shaped like:
 *   { "crisis": false, "total_minutes": 23, "steps": [ {..}, {..} ] }
 * or, for a crisis input:
 *   { "crisis": true, "message": "..." }
 *
 * We can't JSON.parse an incomplete object, so this walks the buffer and
 * pulls out whatever is already complete: the crisis flag/message, the total,
 * and every fully-closed step object inside the "steps" array. Partial trailing
 * objects are ignored until they finish streaming.
 *
 * It is deliberately tolerant — malformed fragments simply don't contribute.
 */
export function parseStreamingBreakdown(buffer: string): PartialBreakdown {
  const result: PartialBreakdown = {
    crisis: false,
    crisisMessage: null,
    totalMinutes: null,
    steps: [],
  };

  // --- crisis flag ---------------------------------------------------------
  const crisisMatch = buffer.match(/"crisis"\s*:\s*(true|false)/);
  if (crisisMatch) {
    result.crisis = crisisMatch[1] === "true";
  }

  // --- crisis message ------------------------------------------------------
  // Grab a complete "message": "..." string (handles escaped quotes).
  const messageMatch = buffer.match(/"message"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (messageMatch && messageMatch[1] !== undefined) {
    result.crisisMessage = decodeJsonString(messageMatch[1]);
  }

  // --- total minutes -------------------------------------------------------
  const totalMatch = buffer.match(/"total_minutes"\s*:\s*(\d+)/);
  if (totalMatch && totalMatch[1] !== undefined) {
    result.totalMinutes = parseInt(totalMatch[1], 10);
  }

  // --- steps array ---------------------------------------------------------
  result.steps = extractCompleteObjects(buffer, '"steps"')
    .map(coerceStep)
    .filter((s): s is BreakdownStep => s !== null);

  return result;
}

/**
 * Find the array following `keyToken` (e.g. '"steps"') and return every
 * balanced, complete `{...}` object substring inside it. Respects string
 * literals and escapes so braces inside strings don't confuse the scanner.
 */
function extractCompleteObjects(buffer: string, keyToken: string): string[] {
  const keyIdx = buffer.indexOf(keyToken);
  if (keyIdx === -1) return [];

  const arrStart = buffer.indexOf("[", keyIdx);
  if (arrStart === -1) return [];

  const objects: string[] = [];
  let depth = 0;
  let objStart = -1;
  let inString = false;
  let escaped = false;

  for (let i = arrStart + 1; i < buffer.length; i++) {
    const ch = buffer[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && objStart !== -1) {
        objects.push(buffer.slice(objStart, i + 1));
        objStart = -1;
      }
    } else if (ch === "]" && depth === 0) {
      // Reached the end of the array; nothing more to collect.
      break;
    }
  }

  return objects;
}

/** Turn a candidate JSON object string into a validated BreakdownStep. */
function coerceStep(raw: string): BreakdownStep | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;
  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  if (!title) return null;

  const minutesRaw = obj.minutes;
  let minutes =
    typeof minutesRaw === "number"
      ? minutesRaw
      : typeof minutesRaw === "string"
        ? parseInt(minutesRaw, 10)
        : NaN;
  if (!Number.isFinite(minutes) || minutes <= 0) minutes = 2;
  minutes = Math.max(1, Math.min(20, Math.round(minutes)));

  const tip =
    typeof obj.tip === "string" && obj.tip.trim() ? obj.tip.trim() : undefined;

  return { title, minutes, tip };
}

/**
 * Extract a "message" string from a partially-streamed {"message": "..."}
 * object — including while the string is still open (no closing quote yet),
 * so the UI can type it out live. Also reports the crisis flag.
 */
export function parseStreamingMessage(buffer: string): {
  message: string;
  crisis: boolean;
  complete: boolean;
} {
  const crisis = /"crisis"\s*:\s*true/.test(buffer);

  // Complete string first.
  const done = buffer.match(/"message"\s*:\s*"((?:\\.|[^"\\])*)"/);
  if (done && done[1] !== undefined) {
    return { message: decodeJsonString(done[1]), crisis, complete: true };
  }

  // Still streaming: take everything after the opening quote.
  const open = buffer.match(/"message"\s*:\s*"((?:\\.|[^"\\])*)$/);
  if (open && open[1] !== undefined) {
    // Drop a trailing lone backslash (an escape split across chunks).
    const raw = open[1].endsWith("\\") ? open[1].slice(0, -1) : open[1];
    return { message: decodeJsonString(raw), crisis, complete: false };
  }

  return { message: "", crisis, complete: false };
}

/** A generic {title, minutes, id?} item used by triage/plan responses. */
export interface ParsedItem {
  title: string;
  minutes: number;
  id?: string;
}

/**
 * Extract complete {title, minutes, id?} objects from the array following
 * `key` (e.g. '"must"') in a partially-streamed buffer.
 */
export function parseItemsArray(buffer: string, key: string): ParsedItem[] {
  return extractCompleteObjects(buffer, `"${key}"`)
    .map((raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return null;
      }
      if (typeof parsed !== "object" || parsed === null) return null;
      const obj = parsed as Record<string, unknown>;
      const title = typeof obj.title === "string" ? obj.title.trim() : "";
      if (!title) return null;
      let minutes =
        typeof obj.minutes === "number"
          ? obj.minutes
          : parseInt(String(obj.minutes ?? ""), 10);
      if (!Number.isFinite(minutes) || minutes <= 0) minutes = 5;
      minutes = Math.max(1, Math.min(240, Math.round(minutes)));
      const id = typeof obj.id === "string" && obj.id ? obj.id : undefined;
      const item: ParsedItem = id ? { title, minutes, id } : { title, minutes };
      return item;
    })
    .filter((x): x is ParsedItem => x !== null);
}

/**
 * Extract complete JSON objects (as parsed records) from the array following
 * `key`. Generic — callers pick out the fields they need. Tolerant of a
 * still-streaming trailing object.
 */
export function parseObjectsArray(
  buffer: string,
  key: string,
): Record<string, unknown>[] {
  return extractCompleteObjects(buffer, `"${key}"`)
    .map((raw) => {
      try {
        const v = JSON.parse(raw);
        return typeof v === "object" && v !== null
          ? (v as Record<string, unknown>)
          : null;
      } catch {
        return null;
      }
    })
    .filter((x): x is Record<string, unknown> => x !== null);
}

/** Pull a top-level string field (e.g. "name") from a partial buffer. */
export function parseStringField(buffer: string, key: string): string | null {
  const m = buffer.match(
    new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`),
  );
  if (!m || m[1] === undefined) return null;
  return decodeJsonString(m[1]);
}

/**
 * Extract complete strings from the array following `key`
 * (e.g. '"captured"') in a partially-streamed buffer.
 */
export function parseStringsArray(buffer: string, key: string): string[] {
  const keyIdx = buffer.indexOf(`"${key}"`);
  if (keyIdx === -1) return [];
  const arrStart = buffer.indexOf("[", keyIdx);
  if (arrStart === -1) return [];

  const out: string[] = [];
  let i = arrStart + 1;
  let inString = false;
  let escaped = false;
  let current = "";

  for (; i < buffer.length; i++) {
    const ch = buffer[i];
    if (inString) {
      if (escaped) {
        current += ch;
        escaped = false;
      } else if (ch === "\\") {
        current += ch;
        escaped = true;
      } else if (ch === '"') {
        inString = false;
        out.push(decodeJsonString(current));
        current = "";
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === "]") {
      break;
    } else if (ch === "{") {
      break; // not a string array — bail safely
    }
  }
  return out.filter((s) => s.trim().length > 0);
}

/** Decode a raw JSON string body (without surrounding quotes). */
function decodeJsonString(raw: string): string {
  let out: string;
  try {
    out = JSON.parse(`"${raw}"`);
  } catch {
    out = raw.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return sanitizeText(out);
}

/**
 * Strip control characters and any stray HTML-ish angle brackets from
 * model output before it's rendered. React already escapes text nodes, so
 * this is defence-in-depth against control-char/markup surprises, not the
 * primary guard.
 */
export function sanitizeText(s: string): string {
  return (
    s
      // Strip control chars except tab/newline/carriage-return.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .replace(/[<>]/g, "")
      .trim()
  );
}
