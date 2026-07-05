import { BREAKDOWN_MODEL, getGemini } from "./gemini";

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
        console.error("gemini stream error:", err);
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
