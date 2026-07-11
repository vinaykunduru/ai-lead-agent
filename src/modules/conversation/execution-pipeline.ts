import "server-only";
import { resolveWidgetForPublicRequest } from "@/modules/widget/resolve-public-request";
import { loadAiBehaviourForConversation } from "@/modules/ai-behaviour/conversation-config";
import { retrieveKnowledgeForConversation } from "@/modules/knowledge/search-service";
import { generateSystemPrompt } from "@/modules/ai-behaviour/prompt-generator";
import { renderStructuredPrompt } from "@/modules/ai-behaviour/rendering";
import { isWithinBusinessHours } from "@/modules/ai-behaviour/business-hours-utils";
import { getAiProvider } from "@/providers/ai";
import { resolveConversation, resolveSession, touchActivity } from "./session-service";
import { insertMessage, listMessages, updateMessage } from "./message-service";
import { buildHistoryWindow } from "./memory";
import { confidenceFromSimilarity, recordCitations } from "./citations";
import { recordUsage } from "./usage-service";
import type { ConversationTransport } from "./transport/types";
import type { SendMessageInput } from "./validation";

const MAX_ERROR_MESSAGE_LENGTH = 500;
const GENERIC_PROVIDER_ERROR = "The assistant could not generate a response right now.";

/**
 * The full execution pipeline (module spec §8):
 *
 *   Resolve Widget → Validate Public Key → Validate Allowed Domain
 *     → Load AI Behaviour → Retrieve Knowledge → Generate Structured Prompt
 *     → Render Provider Prompt → Call Provider → Stream Response
 *     → Store Conversation → Return
 *
 * Transport-agnostic: this function knows nothing about SSE, HTTP, or any
 * wire format — it only calls `transport.send(...)` (module spec §9). The
 * route handler (src/app/api/widget/messages/route.ts) is the only place
 * that knows this is served over SSE.
 */
export async function handleIncomingMessage(
  input: SendMessageInput,
  originHostname: string | null,
  transport: ConversationTransport,
  signal: AbortSignal,
): Promise<void> {
  // Resolve Widget → Validate Public Key → Validate Allowed Domain
  const widget = await resolveWidgetForPublicRequest(input.key, originHostname);

  const session = await resolveSession(widget.organizationId, widget.id, input.visitorId);
  const conversation = await resolveConversation(session, input.conversationId);
  transport.send({ type: "ready", conversationId: conversation.id, sessionId: session.id });

  await insertMessage({
    organizationId: widget.organizationId,
    conversationId: conversation.id,
    role: "user",
    content: input.message,
    status: "complete",
  });

  // Load AI Behaviour
  const behaviourConfig = await loadAiBehaviourForConversation(widget.organizationId);

  // Outside-business-hours short-circuit: respond with the company's
  // configured message and skip retrieval/provider entirely — this is the
  // one place business hours actually changes behavior rather than just
  // being informational prompt context.
  const withinHours = isWithinBusinessHours({
    workingDays: Array.isArray(behaviourConfig.businessHours.workingDays)
      ? (behaviourConfig.businessHours.workingDays as string[])
      : [],
    startTime: behaviourConfig.businessHours.startTime,
    endTime: behaviourConfig.businessHours.endTime,
    timezone: behaviourConfig.businessHours.timezone,
    holidayMode: behaviourConfig.businessHours.holidayMode,
  });

  if (!withinHours && behaviourConfig.businessHours.outsideHoursResponse) {
    const offlineText = behaviourConfig.businessHours.outsideHoursResponse;
    const assistantMessage = await insertMessage({
      organizationId: widget.organizationId,
      conversationId: conversation.id,
      role: "assistant",
      content: offlineText,
      status: "complete",
    });
    transport.send({ type: "token", text: offlineText });
    transport.send({ type: "done", messageId: assistantMessage.id, promptTokens: 0, completionTokens: 0 });
    await touchActivity(session.id, conversation.id);
    return;
  }

  // Retrieve Knowledge
  const retrievedChunks = await retrieveKnowledgeForConversation(widget.organizationId, input.message);

  // Generate Structured Prompt → Render Provider Prompt
  const structuredPrompt = generateSystemPrompt(behaviourConfig);
  const renderedPrompt = renderStructuredPrompt(behaviourConfig.profile.aiProvider, structuredPrompt);

  const history = await listMessages(conversation.id);
  const historyWindow = buildHistoryWindow(history.map((m) => ({ role: m.role, content: m.content })));

  const provider = getAiProvider(behaviourConfig.profile.aiProvider);

  // Inserted before the provider call (status='streaming') so the
  // Conversation Inspector — and a future reconnect flow — can see
  // in-flight generations, not just finished ones.
  const assistantMessage = await insertMessage({
    organizationId: widget.organizationId,
    conversationId: conversation.id,
    role: "assistant",
    content: "",
    status: "streaming",
    provider: provider.id,
    model: provider.model,
  });

  let accumulated = "";
  let promptTokens = 0;
  let completionTokens = 0;
  const startedAt = Date.now();
  let errored = false;

  try {
    // Call Provider → Stream Response
    for await (const event of provider.streamChat({
      systemPrompt: renderedPrompt,
      messages: historyWindow,
      signal,
    })) {
      if (event.type === "token") {
        accumulated += event.text;
        transport.send({ type: "token", text: event.text });
      } else if (event.type === "done") {
        promptTokens = event.promptTokens;
        completionTokens = event.completionTokens;
      } else if (event.type === "error") {
        errored = true;
        await updateMessage(assistantMessage.id, {
          status: "error",
          errorMessage: event.message.slice(0, MAX_ERROR_MESSAGE_LENGTH),
        });
        transport.send({ type: "error", message: GENERIC_PROVIDER_ERROR });
        break;
      }
    }
  } catch (error) {
    errored = true;
    const message = error instanceof Error ? error.message : "Unknown provider error";
    await updateMessage(assistantMessage.id, {
      status: "error",
      errorMessage: message.slice(0, MAX_ERROR_MESSAGE_LENGTH),
    });
    transport.send({ type: "error", message: GENERIC_PROVIDER_ERROR });
  }

  if (errored) {
    await touchActivity(session.id, conversation.id);
    return;
  }

  // Store Conversation
  const latencyMs = Date.now() - startedAt;
  await updateMessage(assistantMessage.id, {
    content: accumulated,
    status: "complete",
    promptTokens,
    completionTokens,
    latencyMs,
  });

  await recordCitations(widget.organizationId, conversation.id, assistantMessage.id, retrievedChunks);

  await recordUsage({
    organizationId: widget.organizationId,
    conversationId: conversation.id,
    messageId: assistantMessage.id,
    provider: provider.id,
    model: provider.model,
    promptTokens,
    completionTokens,
    latencyMs,
  });

  // Widget decides later whether to display citations — the event is sent
  // regardless; the current SDK just doesn't render it (module spec §7).
  const topCitations = retrievedChunks.slice(0, 3);
  if (topCitations.length > 0) {
    transport.send({
      type: "citations",
      citations: topCitations.map((chunk) => ({
        documentTitle: chunk.documentTitle,
        chunkPreview: chunk.content.slice(0, 200),
        confidence: confidenceFromSimilarity(chunk.similarity),
      })),
    });
  }

  // Return
  transport.send({ type: "done", messageId: assistantMessage.id, promptTokens, completionTokens });
  await touchActivity(session.id, conversation.id);
}
