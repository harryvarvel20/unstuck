import { BREAKDOWN_MODEL, getGemini } from "./gemini";

/**
 * Hard ceiling on a single Gemini stream (AA3-D3).
 *
 * Without this, a hung upstream call had nothing to stop it: the `for await`
 * below simply waited, and the only backstop was Vercel's function timeout —
 * which defaults to **300 seconds** under fluid compute. One stalled request
 * could therefore hold a function instance for five minutes.
 *
 * Deliberately set below the 60s `maxDuration` the AI routes declare, so the
 * stream fails on OUR terms — a 502 if it trips before the response is
 * committed, an errored stream after — rather than being killed mid-flight by
 * the platform. Healthy breakdowns complete in well under ten seconds, so this
 * only ever trips on a genuine stall.
 *
 * Note: per the SDK, aborting is client-side only — it frees the function, it
 * does not cancel Google's work, and the tokens already produced are billed.
 */
export const GEMINI_STREAM_TIMEOUT_MS = 45_000;

interface StreamArgs {
  system: string;
  user: string;
  maxTokens?: number;
  /** Optional image (base64, no data: prefix) for multimodal requests. */
  image?: { base64: string; mimeType: string };
}

/**
 * Shared streaming plumbing for every AI route: opens a Gemini stream
 * (strict JSON, thinking off) and pipes the text deltas straight through as a
 * plain-text streamed Response. Callers must have already validated input and
 * enforced quotas.
 */
export async function streamGeminiJson({
  system,
  user,
  maxTokens = 2048,
  image,
}: StreamArgs): Promise<Response> {
  const ai = getGemini(); // throws if unconfigured — caller catches
  const encoder = new TextEncoder();

  // Multimodal requests pass an image part + the text part.
  const contents = image
    ? [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: image.mimeType, data: image.base64 } },
            { text: user },
          ],
        },
      ]
    : user;

  // Open the upstream stream BEFORE constructing the Response (AA5-D5).
  //
  // Previously this call lived inside the ReadableStream's `start`, which runs
  // AFTER a 200 has already been committed. Any failure — bad key, quota
  // exhausted, upstream outage — could then only close an empty body. The
  // client's `parseStreamingBreakdown("")` yields zero steps, and
  // BreakdownScreen sets status "done": the user saw a *successful* breakdown
  // containing nothing. That silently hid a total AI outage on 13 Aug 2026.
  //
  // Awaiting here means auth failures, 429s and bad requests reject while a
  // real status code can still be set. `streamPost` already throws
  // BreakdownError on !res.ok, so no client change is needed — the error path
  // existed all along and the server simply never used it.
  let modelStream: Awaited<ReturnType<typeof ai.models.generateContentStream>>;
  try {
    modelStream = await ai.models.generateContentStream({
      model: BREAKDOWN_MODEL,
      contents,
      config: {
        systemInstruction: system,
        responseMimeType: "application/json",
        maxOutputTokens: maxTokens,
        thinkingConfig: { thinkingBudget: 0 },
        abortSignal: AbortSignal.timeout(GEMINI_STREAM_TIMEOUT_MS),
      },
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") {
      console.error(
        `gemini stream timed out after ${GEMINI_STREAM_TIMEOUT_MS}ms`,
      );
    } else {
      console.error("gemini stream error:", err);
    }
    // 502, never 429 — `streamPost` maps 429 to LimitReachedError, which tells
    // the user they have used their allowance. An upstream quota problem is
    // ours, and blaming the customer for it would be worse than a generic
    // error.
    return new Response(
      JSON.stringify({
        error: "ai_unavailable",
        message:
          "The AI is having a moment — that one's on us. Try again shortly.",
      }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of modelStream) {
          const text = chunk.text;
          if (text) {
            try {
              controller.enqueue(encoder.encode(text));
            } catch {
              break; // client disconnected
            }
          }
        }
        controller.close();
      } catch (err) {
        // Mid-stream failure. The 200 and its headers are already sent, so the
        // status cannot be corrected — but erroring the stream makes the
        // client's reader reject rather than see a clean end with truncated
        // JSON, which would render as a short but apparently complete
        // breakdown. Rare: normal generations finish well inside the timeout.
        console.error("gemini stream error (mid-stream):", err);
        try {
          controller.error(
            err instanceof Error ? err : new Error("gemini stream failed"),
          );
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store, no-transform",
    },
  });
}
