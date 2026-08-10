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
 * stream fails on OUR terms (logged, stream closed cleanly) rather than being
 * killed mid-flight by the platform. Healthy breakdowns complete in well under
 * ten seconds, so this only ever trips on a genuine stall.
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
export function streamGeminiJson({
  system,
  user,
  maxTokens = 2048,
  image,
}: StreamArgs): Response {
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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const modelStream = await ai.models.generateContentStream({
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
        // A stall aborted by GEMINI_STREAM_TIMEOUT_MS surfaces as a
        // TimeoutError/AbortError. Log it distinctly so it is separable from a
        // genuine upstream fault when reading Vercel logs (AA5).
        const name = err instanceof Error ? err.name : "";
        if (name === "TimeoutError" || name === "AbortError") {
          console.error(
            `gemini stream timed out after ${GEMINI_STREAM_TIMEOUT_MS}ms`,
          );
        } else {
          console.error("gemini stream error:", err);
        }
        // Closing (rather than erroring) preserves the existing wire contract:
        // callers already treat an empty/partial body as a failure.
        try {
          controller.close();
        } catch {
          /* noop */
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
