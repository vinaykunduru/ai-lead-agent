/**
 * Pure, deterministic — module spec §4's signals combine into a 0–100
 * score via a fixed, documented weight table. Only the *signals* need
 * subjective judgment (intent/urgency/buying/support come from AI summary
 * generation — modules/leads/ai-summary.ts); turning a fully-formed signal
 * set into a number is ordinary math, and kept separate specifically so it
 * stays unit-testable without any LLM dependency.
 */
export type LeadScoreSignals = {
  emailCaptured: boolean;
  phoneCaptured: boolean;
  companyCaptured: boolean;
  /** Number of messages in the conversation so far. */
  messageCount: number;
  budgetMentioned: boolean;
  /** 0–10, from AI summary generation. */
  intentScore: number;
  /** 0–10, from AI summary generation. */
  urgencyScore: number;
  /** 0–10, from AI summary generation. */
  buyingSignalsScore: number;
  /** 0–10, from AI summary generation — support-only signals reduce
   * sales-readiness rather than add to it. */
  supportSignalsScore: number;
  /** -30..+30, a human's direct override. */
  manualAdjustment: number;
};

export const DEFAULT_SCORE_SIGNALS: LeadScoreSignals = {
  emailCaptured: false,
  phoneCaptured: false,
  companyCaptured: false,
  messageCount: 0,
  budgetMentioned: false,
  intentScore: 0,
  urgencyScore: 0,
  buyingSignalsScore: 0,
  supportSignalsScore: 0,
  manualAdjustment: 0,
};

const WEIGHTS = {
  emailCaptured: 10,
  phoneCaptured: 8,
  companyCaptured: 7,
  budgetMentioned: 15,
  conversationLengthMax: 10,
  conversationLengthMessagesPerPoint: 2,
  intentScore: 15,
  urgencyScore: 10,
  buyingSignalsScore: 15,
  supportSignalsPenaltyMax: 10,
};

export function computeLeadScore(signals: LeadScoreSignals): number {
  let score = 0;
  if (signals.emailCaptured) score += WEIGHTS.emailCaptured;
  if (signals.phoneCaptured) score += WEIGHTS.phoneCaptured;
  if (signals.companyCaptured) score += WEIGHTS.companyCaptured;
  if (signals.budgetMentioned) score += WEIGHTS.budgetMentioned;

  score += Math.min(
    signals.messageCount / WEIGHTS.conversationLengthMessagesPerPoint,
    WEIGHTS.conversationLengthMax,
  );
  score += (clamp10(signals.intentScore) / 10) * WEIGHTS.intentScore;
  score += (clamp10(signals.urgencyScore) / 10) * WEIGHTS.urgencyScore;
  score += (clamp10(signals.buyingSignalsScore) / 10) * WEIGHTS.buyingSignalsScore;
  score -= (clamp10(signals.supportSignalsScore) / 10) * WEIGHTS.supportSignalsPenaltyMax;

  score += signals.manualAdjustment;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function clamp10(value: number): number {
  return Math.max(0, Math.min(10, value));
}
