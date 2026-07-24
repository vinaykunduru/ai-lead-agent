import "server-only";
import { after } from "next/server";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import { conversationMessages, conversations } from "@/db/schema";
import { resolveWidgetForPublicRequest } from "@/modules/widget/resolve-public-request";
import { loadAiBehaviourForConversation, loadHandoffSettingsForConversation } from "@/modules/ai-behaviour/conversation-config";
import { retrieveKnowledgeForConversation } from "@/modules/knowledge/search-service";
import { generateSystemPrompt } from "@/modules/ai-behaviour/prompt-generator";
import { renderStructuredPrompt } from "@/modules/ai-behaviour/rendering";
import { isWithinBusinessHours } from "@/modules/ai-behaviour/business-hours-utils";
import { getAiProvider } from "@/providers/ai";
import { resolveConversation, resolveSession, touchActivity } from "./session-service";
import { insertMessage, listMessages, updateMessage } from "./message-service";
import { buildHistoryWindow } from "./memory";
import { appendKnowledgeContext } from "./knowledge-context";
import { confidenceFromSimilarity, recordCitations } from "./citations";
import { recordUsage } from "./usage-service";
import { findLeadIdForConversation } from "@/modules/inbox/shared";
import { recordActivity } from "@/modules/leads/activity";
import { recordAuditLog } from "@/modules/audit/service";
import { ensureVisitorProfileForSession } from "@/modules/visitor-profiles/resolve-service";
import { runImmediateExtraction } from "./extraction/stage1";
import { runBackgroundExtraction } from "./extraction/stage2";
import type { ConversationTransport } from "./transport/types";
import type { SendMessageInput } from "./validation";

const MAX_ERROR_MESSAGE_LENGTH = 500;
const GENERIC_PROVIDER_ERROR = "The assistant could not generate a response right now.";
const DEFAULT_HANDOFF_MESSAGE = "Thanks for your message — a team member will get back to you shortly.";

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

  // Visitor Profile & Lead Qualification (Stage 1, immediate): every
  // session always has a profile — even a blank one — so there's a stable
  // id to progressively enrich. Regex-only, synchronous, so this never adds
  // meaningful latency; the result feeds straight into prompt generation
  // below so the model already knows about anything just shared this turn.
  let visitorProfile = await ensureVisitorProfileForSession(session);
  visitorProfile = await runImmediateExtraction({
    organizationId: widget.organizationId,
    sessionId: session.id,
    visitorProfileId: visitorProfile.id,
    message: input.message,
  });

  // Human Takeover (module spec §6): a human already owns this
  // conversation — store the visitor's message (above) and stop. The AI
  // never answers again until modules/inbox/takeover-service.ts's
  // resumeAiConversation flips ownership back.
  if (conversation.owner === "human") {
    await touchActivity(session.id, conversation.id);
    transport.send({ type: "handoff", message: DEFAULT_HANDOFF_MESSAGE });
    return;
  }

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
  const structuredPrompt = generateSystemPrompt({ ...behaviourConfig, visitor: visitorProfile });
  const renderedPrompt = appendKnowledgeContext(
    renderStructuredPrompt(behaviourConfig.profile.aiProvider, structuredPrompt),
    retrievedChunks,
    structuredPrompt.guardrails.fallbackMessage,
  );

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

  // Automatic escalation (module spec §6): ai_handoff_settings has existed
  // since the AI Behaviour milestone documented as "does not implement
  // escalation delivery; that belongs to the future conversation-engine
  // phase" — this is that phase. Counts every AI-authored assistant
  // message in the conversation so far; once it reaches maxAiAttempts, the
  // conversation hands off to a human the same way a manual takeover does.
  const handoffSettings = await loadHandoffSettingsForConversation(widget.organizationId);
  if (handoffSettings.escalationEnabled) {
    const aiMessageCount = await countAiAuthoredMessages(conversation.id);
    if (aiMessageCount >= handoffSettings.maxAiAttempts) {
      await escalateToHuman(widget.organizationId, conversation.id);
      if (handoffSettings.escalationMessage) {
        transport.send({ type: "token", text: `\n\n${handoffSettings.escalationMessage}` });
      }
    }
  }

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

  // Visitor Profile & Lead Qualification (Stage 2, background): scheduled
  // via Next's after() so it only starts once this response has already
  // been fully sent to the visitor — module spec: "must NEVER increase
  // response latency." Best-effort; every failure inside is swallowed.
  after(() =>
    runBackgroundExtraction({
      organizationId: widget.organizationId,
      widgetId: widget.id,
      sessionId: session.id,
      conversationId: conversation.id,
      visitorProfileId: visitorProfile.id,
      aiProvider: behaviourConfig.profile.aiProvider,
    }),
  );
}

async function countAiAuthoredMessages(conversationId: string): Promise<number> {
  const rows = await db
    .select({ id: conversationMessages.id })
    .from(conversationMessages)
    .where(
      and(
        eq(conversationMessages.conversationId, conversationId),
        eq(conversationMessages.role, "assistant"),
        isNotNull(conversationMessages.provider),
      ),
    );
  return rows.length;
}

/**
 * Service-role, same shape as modules/inbox/takeover-service.ts's manual
 * takeoverConversation — deliberately not reusing that function directly
 * since it's RLS-scoped (requireCompanySession) and this runs from the
 * visitor-facing pipeline, which has no company session. Both end up
 * setting the exact same fields.
 */
async function escalateToHuman(organizationId: string, conversationId: string): Promise<void> {
  // Plain service-role transaction (not withRlsContext — there is no
  // company user here) purely so recordActivity/findLeadIdForConversation
  // get a transaction handle of the same type they use in every other,
  // RLS-scoped call site.
  await db.transaction(async (tx) => {
    await tx
      .update(conversations)
      .set({ owner: "human", takeoverReason: "automatic", takeoverAt: new Date(), updatedAt: new Date() })
      .where(eq(conversations.id, conversationId));

    const leadId = await findLeadIdForConversation(tx, organizationId, conversationId);
    if (leadId) {
      await recordActivity(tx, {
        organizationId,
        leadId,
        type: "escalated",
        actorUserId: null,
        metadata: { reason: "automatic" },
      });
    }
  });

  await recordAuditLog({
    organizationId,
    actorUserId: null,
    actorType: "system",
    action: "inbox.escalated",
    resourceType: "conversation",
    resourceId: conversationId,
    metadata: { reason: "automatic" },
  });
}
