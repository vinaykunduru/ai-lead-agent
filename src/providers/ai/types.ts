import type { PromptRendererId } from "@/modules/ai-behaviour/rendering";

export type AiChatMessage = { role: "user" | "assistant"; content: string };

export type AiStreamEvent =
  | { type: "token"; text: string }
  | { type: "done"; promptTokens: number; completionTokens: number }
  | { type: "error"; message: string };

export type AiChatInput = {
  /** Already-rendered, vendor-specific prompt text — see
   * modules/ai-behaviour/rendering. Providers never see the structured
   * prompt object or do any of their own formatting. */
  systemPrompt: string;
  messages: AiChatMessage[];
  signal?: AbortSignal;
};

/**
 * One implementation per providers/ai/*.ts file, keyed by the same
 * PromptRendererId used by modules/ai-behaviour/rendering — a provider and
 * its matching renderer are always selected together (ai_profiles.aiProvider).
 * Pure execution: given rendered text + history, stream tokens back. No
 * knowledge of retrieval, prompt assembly, or conversation storage — those
 * stay in modules/conversation.
 */
export interface AiProvider {
  readonly id: PromptRendererId;
  /** The specific model string this provider is currently configured to
   * call — recorded on conversation_messages/conversation_usage so a
   * historical record survives a later model-name change. */
  readonly model: string;
  streamChat(input: AiChatInput): AsyncGenerator<AiStreamEvent>;
}
