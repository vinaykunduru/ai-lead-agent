import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { conversationMessages } from "@/db/schema";
import { getAiProvider } from "@/providers/ai";
import { extractJsonObject, clampScore, toOptionalString } from "@/providers/ai/json-response";
import type { PromptRendererId } from "@/modules/ai-behaviour/rendering";
import { enrichVisitorProfile } from "@/modules/visitor-profiles/resolve-service";
import { resolveActiveLeadForVisitor } from "@/modules/leads/auto-service";
import { updateLeadFromExtraction } from "@/modules/leads/qualification-service";

const EXTRACTION_SYSTEM_PROMPT = `You analyze a sales conversation between an AI assistant and a website visitor. Extract structured information about the visitor and how sales-ready they are. Respond with ONLY a single JSON object, no other text, no markdown code fences, matching exactly this shape:
{
  "name": string or null (the visitor's name, only if they stated it themselves),
  "company": string or null,
  "designation": string or null,
  "industry": string or null,
  "interestedService": string or null (what product/service they're asking about),
  "requirement": string or null (a one-sentence description of what they need),
  "budget": string or null (as stated, e.g. "around 2 lakh" — do not convert currency or invent a number),
  "timeline": string or null (as stated, e.g. "within two weeks"),
  "teamSize": string or null,
  "currentSolution": string or null (what they use today, if mentioned),
  "preferredContactTime": string or null,
  "intent": string or null (one short phrase, e.g. "evaluating CRM options for a sales team"),
  "sentiment": "positive" or "neutral" or "negative" or null,
  "conversationSummary": string or null (2-3 sentences, third person),
  "nextRecommendedAction": string or null (what a salesperson should do next),
  "qualificationStatus": "cold" or "warm" or "hot" or null (your overall judgment from context — depth of engagement, urgency, budget clarity, buying signals — not a single numeric threshold),
  "intentScore": number from 0 to 10 (how likely they are to buy),
  "urgencyScore": number from 0 to 10 (how time-sensitive their need is),
  "buyingSignalsScore": number from 0 to 10 (explicit buying signals present),
  "supportSignalsScore": number from 0 to 10 (how much this looks like a support request rather than a sales opportunity),
  "budgetMentioned": boolean
}
Only use information actually present in the conversation. If something isn't mentioned, use null — never invent details. Never include contact details (phone/email) here; those are extracted separately.`;

type RawExtraction = Record<string, unknown>;

function qualificationStatus(value: unknown): "cold" | "warm" | "hot" | null {
  return value === "cold" || value === "warm" || value === "hot" ? value : null;
}

function sentiment(value: unknown): string | null {
  return value === "positive" || value === "neutral" || value === "negative" ? value : null;
}

/**
 * Stage 2 (Background) — module spec: "Run an asynchronous structured AI
 * extraction after the assistant response has already been delivered...
 * must NEVER increase response latency." The caller (execution-pipeline.ts)
 * schedules this via Next's `after()`, so it only starts once the visitor
 * has already received their reply and the SSE stream has flushed — this
 * function itself has no knowledge of that; it just needs to be safe to run
 * detached, with every failure swallowed rather than surfaced anywhere.
 *
 * Reuses the exact same "prompt the org's configured provider for strict
 * JSON, defensively parse it" shape as modules/leads/ai-summary.ts's
 * generateLeadSummary — same provider contract, same defensive parsing
 * helpers (providers/ai/json-response.ts), just triggered automatically
 * instead of by a dashboard button click, and written through service-role
 * paths since there is no company session here.
 */
export async function runBackgroundExtraction(params: {
  organizationId: string;
  widgetId: string;
  sessionId: string;
  conversationId: string;
  visitorProfileId: string;
  aiProvider: PromptRendererId;
}): Promise<void> {
  try {
    const messages = await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, params.conversationId))
      .orderBy(asc(conversationMessages.createdAt));

    const transcriptMessages = messages.filter((m) => m.role === "user" || m.role === "assistant");
    if (transcriptMessages.length === 0) return;

    const transcript = transcriptMessages.map((m) => `${m.role}: ${m.content}`).join("\n");
    const provider = getAiProvider(params.aiProvider);

    let accumulated = "";
    for await (const event of provider.streamChat({
      systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: transcript }],
    })) {
      if (event.type === "token") accumulated += event.text;
      else if (event.type === "error") return; // best-effort: never break the visitor's already-delivered reply
    }

    let raw: RawExtraction;
    try {
      raw = JSON.parse(extractJsonObject(accumulated)) as RawExtraction;
    } catch {
      return;
    }

    await enrichVisitorProfile({
      organizationId: params.organizationId,
      sessionId: params.sessionId,
      currentVisitorProfileId: params.visitorProfileId,
      fields: {
        name: toOptionalString(raw.name) ?? undefined,
        company: toOptionalString(raw.company) ?? undefined,
        designation: toOptionalString(raw.designation) ?? undefined,
        industry: toOptionalString(raw.industry) ?? undefined,
        interestedService: toOptionalString(raw.interestedService) ?? undefined,
        requirement: toOptionalString(raw.requirement) ?? undefined,
        budget: toOptionalString(raw.budget) ?? undefined,
        timeline: toOptionalString(raw.timeline) ?? undefined,
        teamSize: toOptionalString(raw.teamSize) ?? undefined,
        currentSolution: toOptionalString(raw.currentSolution) ?? undefined,
        preferredContactTime: toOptionalString(raw.preferredContactTime) ?? undefined,
        intent: toOptionalString(raw.intent) ?? undefined,
        sentiment: sentiment(raw.sentiment) ?? undefined,
        conversationSummary: toOptionalString(raw.conversationSummary) ?? undefined,
        nextRecommendedAction: toOptionalString(raw.nextRecommendedAction) ?? undefined,
      },
    });

    const lead = await resolveActiveLeadForVisitor({
      organizationId: params.organizationId,
      widgetId: params.widgetId,
      conversationId: params.conversationId,
      visitorProfileId: params.visitorProfileId,
    });

    await updateLeadFromExtraction(lead.id, {
      organizationId: params.organizationId,
      qualificationStatus: qualificationStatus(raw.qualificationStatus),
      signals: {
        intentScore: clampScore(raw.intentScore),
        urgencyScore: clampScore(raw.urgencyScore),
        buyingSignalsScore: clampScore(raw.buyingSignalsScore),
        supportSignalsScore: clampScore(raw.supportSignalsScore),
        budgetMentioned: Boolean(raw.budgetMentioned),
        messageCount: transcriptMessages.length,
      },
    });
  } catch {
    // Best-effort background task, detached from any user-facing surface —
    // never let an extraction failure be visible anywhere.
  }
}
