import "server-only";
import { parseSseStream } from "./sse-parser";
import type { AiChatInput, AiProvider, AiStreamEvent } from "./types";
import type { PromptRendererId } from "@/modules/ai-behaviour/rendering";

// Only the fields read from an OpenAI-compatible chat-completions stream —
// see https://platform.openai.com/docs/api-reference/chat-streaming. Groq,
// Together, and self-hosted vLLM/Ollama servers all implement this same
// shape, which is why providers/ai/openai.ts and providers/ai/llama.ts
// both build on this one implementation instead of duplicating it.
type OpenAiCompatibleStreamChunk = {
  choices?: { delta?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

export type OpenAiCompatibleConfig = {
  id: PromptRendererId;
  apiUrl: string;
  apiKey: string | undefined;
  model: string;
  missingKeyMessage: string;
};

export function createOpenAiCompatibleProvider(config: OpenAiCompatibleConfig): AiProvider {
  return {
    id: config.id,
    model: config.model,
    async *streamChat(input: AiChatInput): AsyncGenerator<AiStreamEvent> {
      if (!config.apiKey || !config.apiUrl) {
        yield { type: "error", message: config.missingKeyMessage };
        return;
      }

      let response: Response;
      try {
        response = await fetch(config.apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages: [{ role: "system", content: input.systemPrompt }, ...input.messages],
            stream: true,
            stream_options: { include_usage: true },
          }),
          signal: input.signal,
        });
      } catch (error) {
        yield {
          type: "error",
          message: `${config.id} request failed: ${error instanceof Error ? error.message : "network error"}`,
        };
        return;
      }

      if (!response.ok || !response.body) {
        const body = await response.text().catch(() => "");
        yield {
          type: "error",
          message: `${config.id} request failed (${response.status}): ${body.slice(0, 300)}`,
        };
        return;
      }

      let promptTokens = 0;
      let completionTokens = 0;

      for await (const payload of parseSseStream(response.body)) {
        if (payload === "[DONE]") break;
        let chunk: OpenAiCompatibleStreamChunk;
        try {
          chunk = JSON.parse(payload) as OpenAiCompatibleStreamChunk;
        } catch {
          continue;
        }

        const text = chunk.choices?.[0]?.delta?.content;
        if (text) yield { type: "token", text };
        if (chunk.usage) {
          promptTokens = chunk.usage.prompt_tokens ?? promptTokens;
          completionTokens = chunk.usage.completion_tokens ?? completionTokens;
        }
      }

      yield { type: "done", promptTokens, completionTokens };
    },
  };
}
