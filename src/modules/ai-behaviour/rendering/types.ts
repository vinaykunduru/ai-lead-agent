import type { StructuredPrompt } from "../prompt-generator";

export const PROMPT_RENDERER_IDS = ["openai", "claude", "gemini", "llama"] as const;
export type PromptRendererId = (typeof PROMPT_RENDERER_IDS)[number];

/**
 * Turns a provider-independent StructuredPrompt into the system-prompt text
 * a specific AI vendor expects. Pure string formatting only — no network
 * calls, no vendor SDK, no API key. modules/ai-behaviour never calls a live
 * AI provider (see module scope); a renderer is the seam a future
 * chat-engine module would render through, immediately before actually
 * sending something to a real provider.
 *
 * generateSystemPrompt() (../prompt-generator.ts) must never grow
 * vendor-specific formatting — that responsibility belongs entirely here,
 * one file per vendor, so adding a new provider never touches the
 * structured-generation code path.
 */
export type PromptRenderer = (prompt: StructuredPrompt) => string;
