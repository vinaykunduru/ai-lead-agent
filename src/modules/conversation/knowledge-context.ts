import type { ConversationRetrievalChunk } from "@/modules/knowledge/search-service";

/**
 * Merges retrieved knowledge-base chunks into the final system prompt text
 * before it goes to the AI provider. Without this step, retrieval results
 * were computed (for citations) but never actually reached the model — the
 * model had no real grounding content to check against, so it would answer
 * generically and fabricate company-specific facts (pricing, services)
 * despite the platform guardrail telling it not to. That guardrail is only
 * enforceable if the knowledge it refers to is actually present in the
 * prompt — see CLAUDE.md §5 ("must never invent prices, offers, policies,
 * availability... that isn't in the knowledge base").
 */
export function appendKnowledgeContext(
  renderedPrompt: string,
  chunks: ConversationRetrievalChunk[],
  fallbackMessage: string,
): string {
  if (chunks.length === 0) {
    return `${renderedPrompt}

## Knowledge Base
No relevant information was found in the knowledge base for this question. For any company-specific fact (pricing, services, policies, availability, etc.) not covered by your identity/behaviour instructions above, respond with exactly: "${fallbackMessage}" — do not guess, estimate, or substitute general knowledge.`;
  }

  const context = chunks
    .map((chunk, index) => `[${index + 1}] ${chunk.documentTitle}\n${chunk.content}`)
    .join("\n\n");

  return `${renderedPrompt}

## Knowledge Base
The following is real information retrieved from the company's own knowledge base for this specific question. Answer any company-specific fact (pricing, services, policies, availability, etc.) using ONLY this information. If it doesn't fully answer the question, respond with exactly: "${fallbackMessage}" for the parts it doesn't cover — do not guess, estimate, or fill gaps with general knowledge.

When answering:
- If asked for a list (clients, projects, portfolio items, services), include every distinct item present in the context above rather than stopping after a few examples — the visitor asked to see what's there, not a sample.
- If many items are relevant, you may group them by industry or service type to make the answer easier to scan.
- If the visitor's message indicates their own industry or the type of work they need, call out the most relevantly similar items first.
- Format any website or domain mentioned in the context as a clickable markdown link (e.g. "projectname.com" becomes [projectname.com](https://projectname.com)), even if the context itself doesn't include the "https://" prefix.
- If part of the answer must use the fallback message above, don't end the reply there — share what the knowledge base does cover first, or ask a clarifying question, so the conversation keeps moving.

${context}`;
}
