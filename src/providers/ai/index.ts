import type { PromptRendererId } from "@/modules/ai-behaviour/rendering";
import { claudeProvider } from "./claude";
import { openAiProvider } from "./openai";
import { geminiProvider } from "./gemini";
import { llamaProvider } from "./llama";
import type { AiProvider } from "./types";

export type { AiProvider, AiChatInput, AiChatMessage, AiStreamEvent } from "./types";

/**
 * The only place a provider id maps to an implementation — business
 * modules never import a vendor SDK or a specific providers/ai/*.ts file
 * directly (CLAUDE.md §2). Keyed by the same PromptRendererId used for
 * rendering (ai_profiles.aiProvider), so picking a provider and picking its
 * matching renderer are always the same lookup.
 */
export const AI_PROVIDERS: Record<PromptRendererId, AiProvider> = {
  claude: claudeProvider,
  openai: openAiProvider,
  gemini: geminiProvider,
  llama: llamaProvider,
};

export function getAiProvider(id: PromptRendererId): AiProvider {
  return AI_PROVIDERS[id];
}
