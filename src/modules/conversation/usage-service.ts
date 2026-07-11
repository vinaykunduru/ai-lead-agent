import "server-only";
import { db } from "@/db/client";
import { conversationUsage } from "@/db/schema";
import type { PromptRendererId } from "@/modules/ai-behaviour/rendering";

/**
 * Illustrative, approximate $/1K-token rates — NOT an authoritative billing
 * source (module spec §10: "Future billing extension point"). A real
 * billing integration would replace this with each vendor's actual current
 * pricing, likely fetched or configured rather than hardcoded.
 */
const RATE_PER_1K_TOKENS_USD: Record<PromptRendererId, { prompt: number; completion: number }> = {
  claude: { prompt: 0.003, completion: 0.015 },
  openai: { prompt: 0.005, completion: 0.015 },
  gemini: { prompt: 0.00125, completion: 0.005 },
  llama: { prompt: 0.0006, completion: 0.0006 },
};

export function estimateCostUsd(
  provider: PromptRendererId,
  promptTokens: number,
  completionTokens: number,
): number {
  const rate = RATE_PER_1K_TOKENS_USD[provider];
  return (promptTokens / 1000) * rate.prompt + (completionTokens / 1000) * rate.completion;
}

export async function recordUsage(entry: {
  organizationId: string;
  conversationId: string;
  messageId: string;
  provider: PromptRendererId;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
}): Promise<void> {
  await db.insert(conversationUsage).values({
    organizationId: entry.organizationId,
    conversationId: entry.conversationId,
    messageId: entry.messageId,
    provider: entry.provider,
    model: entry.model,
    promptTokens: entry.promptTokens,
    completionTokens: entry.completionTokens,
    latencyMs: entry.latencyMs,
    estimatedCostUsd: estimateCostUsd(entry.provider, entry.promptTokens, entry.completionTokens).toFixed(6),
  });
}
