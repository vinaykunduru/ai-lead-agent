import type { StructuredPrompt } from "../prompt-generator";
import { renderOpenAiPrompt } from "./openai";
import { renderClaudePrompt } from "./claude";
import { renderGeminiPrompt } from "./gemini";
import { renderLlamaPrompt } from "./llama";
import { PROMPT_RENDERER_IDS, type PromptRenderer, type PromptRendererId } from "./types";

export { PROMPT_RENDERER_IDS, type PromptRenderer, type PromptRendererId };

/**
 * The only place a vendor name is mapped to its rendering logic.
 * modules/ai-behaviour never calls a live provider (see module scope) —
 * this registry exists so the future chat-engine module has one place to
 * pick "give me this structured prompt as text for provider X" without
 * reaching into individual renderer files.
 */
export const PROMPT_RENDERERS: Record<PromptRendererId, PromptRenderer> = {
  openai: renderOpenAiPrompt,
  claude: renderClaudePrompt,
  gemini: renderGeminiPrompt,
  llama: renderLlamaPrompt,
};

export function renderStructuredPrompt(rendererId: PromptRendererId, prompt: StructuredPrompt): string {
  return PROMPT_RENDERERS[rendererId](prompt);
}
