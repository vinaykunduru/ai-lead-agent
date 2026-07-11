import "server-only";
import { serverEnv } from "@/lib/env.server";
import { parseSseStream } from "./sse-parser";
import type { AiChatInput, AiProvider, AiStreamEvent } from "./types";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Only the fields this provider reads from Gemini's streamGenerateContent
// SSE response — see
// https://ai.google.dev/api/generate-content#method:-models.streamgeneratecontent
type GeminiStreamChunk = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string };
};

class GeminiProvider implements AiProvider {
  readonly id = "gemini" as const;
  readonly model = serverEnv.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;

  async *streamChat(input: AiChatInput): AsyncGenerator<AiStreamEvent> {
    if (!serverEnv.GEMINI_API_KEY) {
      yield { type: "error", message: "GEMINI_API_KEY is not configured — cannot call Gemini." };
      return;
    }

    const url = `${GEMINI_API_BASE}/${this.model}:streamGenerateContent?alt=sse&key=${serverEnv.GEMINI_API_KEY}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: input.systemPrompt }] },
          // Gemini uses "model" where every other provider here uses
          // "assistant" — the only vendor-specific translation this
          // provider needs to do; everything else is identical shape.
          contents: input.messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        }),
        signal: input.signal,
      });
    } catch (error) {
      yield {
        type: "error",
        message: `Gemini request failed: ${error instanceof Error ? error.message : "network error"}`,
      };
      return;
    }

    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => "");
      yield { type: "error", message: `Gemini request failed (${response.status}): ${body.slice(0, 300)}` };
      return;
    }

    let promptTokens = 0;
    let completionTokens = 0;

    for await (const payload of parseSseStream(response.body)) {
      let chunk: GeminiStreamChunk;
      try {
        chunk = JSON.parse(payload) as GeminiStreamChunk;
      } catch {
        continue;
      }

      if (chunk.error) {
        yield { type: "error", message: chunk.error.message ?? "Gemini returned an error" };
        return;
      }

      const text = chunk.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
      if (text) yield { type: "token", text };

      if (chunk.usageMetadata) {
        promptTokens = chunk.usageMetadata.promptTokenCount ?? promptTokens;
        completionTokens = chunk.usageMetadata.candidatesTokenCount ?? completionTokens;
      }
    }

    yield { type: "done", promptTokens, completionTokens };
  }
}

export const geminiProvider: AiProvider = new GeminiProvider();
