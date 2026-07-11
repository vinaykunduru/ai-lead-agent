import { countTokens } from "gpt-tokenizer";
import type { AiChatMessage } from "@/providers/ai";

const MAX_HISTORY_TOKENS = 3000;
const MAX_HISTORY_MESSAGES = 20;

export type StoredMessage = { role: "user" | "assistant" | "system" | "tool"; content: string };

/**
 * Trims a conversation's full stored message history down to what actually
 * gets sent to the provider — a token budget and a message-count cap,
 * whichever is hit first (module spec §6: "Maximum history, Automatic
 * trimming"). Always keeps the most recent user/assistant turns and drops
 * older ones; the most recent message is always included even if it alone
 * exceeds the budget, so a single long message never produces an empty
 * window.
 *
 * No summarization (explicitly out of scope for this milestone) — this is
 * the extension point a future phase would use: instead of silently
 * dropping older messages once the budget is exhausted, it would replace
 * them with one summarized turn prepended to the window.
 */
export function buildHistoryWindow(
  messages: StoredMessage[],
  maxTokens: number = MAX_HISTORY_TOKENS,
  maxMessages: number = MAX_HISTORY_MESSAGES,
): AiChatMessage[] {
  const chatMessages = messages.filter(
    (m): m is StoredMessage & { role: "user" | "assistant" } => m.role === "user" || m.role === "assistant",
  );

  const windowed: AiChatMessage[] = [];
  let tokenBudget = maxTokens;

  for (let i = chatMessages.length - 1; i >= 0 && windowed.length < maxMessages; i--) {
    const message = chatMessages[i];
    const tokens = countTokens(message.content);
    if (windowed.length > 0 && tokens > tokenBudget) break;
    windowed.unshift({ role: message.role, content: message.content });
    tokenBudget -= tokens;
  }

  return windowed;
}
