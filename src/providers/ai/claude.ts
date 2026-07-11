import "server-only";
import { serverEnv } from "@/lib/env.server";
import { parseSseStream } from "./sse-parser";
import type { AiChatInput, AiProvider, AiStreamEvent } from "./types";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-5";
const CLAUDE_MAX_TOKENS = 1024;
const ANTHROPIC_VERSION = "2023-06-01";

// Only the fields this provider actually reads from Anthropic's
// Messages-API streaming events — see
// https://docs.anthropic.com/en/api/messages-streaming for the full shape.
type ClaudeStreamEvent = {
  type: string;
  message?: { usage?: { input_tokens?: number } };
  delta?: { type?: string; text?: string };
  usage?: { output_tokens?: number };
  error?: { message?: string };
};

class ClaudeProvider implements AiProvider {
  readonly id = "claude" as const;
  readonly model = CLAUDE_MODEL;

  async *streamChat(input: AiChatInput): AsyncGenerator<AiStreamEvent> {
    if (!serverEnv.ANTHROPIC_API_KEY) {
      yield { type: "error", message: "ANTHROPIC_API_KEY is not configured — cannot call Claude." };
      return;
    }

    let response: Response;
    try {
      response = await fetch(CLAUDE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": serverEnv.ANTHROPIC_API_KEY,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          system: input.systemPrompt,
          messages: input.messages.map((m) => ({ role: m.role, content: m.content })),
          max_tokens: CLAUDE_MAX_TOKENS,
          stream: true,
        }),
        signal: input.signal,
      });
    } catch (error) {
      yield {
        type: "error",
        message: `Claude request failed: ${error instanceof Error ? error.message : "network error"}`,
      };
      return;
    }

    if (!response.ok || !response.body) {
      const body = await response.text().catch(() => "");
      yield { type: "error", message: `Claude request failed (${response.status}): ${body.slice(0, 300)}` };
      return;
    }

    let promptTokens = 0;
    let completionTokens = 0;

    for await (const payload of parseSseStream(response.body)) {
      let event: ClaudeStreamEvent;
      try {
        event = JSON.parse(payload) as ClaudeStreamEvent;
      } catch {
        continue;
      }

      if (event.type === "message_start") {
        promptTokens = event.message?.usage?.input_tokens ?? 0;
      } else if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
        if (event.delta.text) yield { type: "token", text: event.delta.text };
      } else if (event.type === "message_delta") {
        completionTokens = event.usage?.output_tokens ?? completionTokens;
      } else if (event.type === "error") {
        yield { type: "error", message: event.error?.message ?? "Claude returned an error" };
        return;
      }
    }

    yield { type: "done", promptTokens, completionTokens };
  }
}

export const claudeProvider: AiProvider = new ClaudeProvider();
