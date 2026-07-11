import { describe, expect, it } from "vitest";
import { computeLeadScore, DEFAULT_SCORE_SIGNALS, type LeadScoreSignals } from "./scoring";

describe("computeLeadScore", () => {
  it("scores an entirely empty signal set at 0", () => {
    expect(computeLeadScore(DEFAULT_SCORE_SIGNALS)).toBe(0);
  });

  it("adds weight for each captured contact field", () => {
    const withEmail = computeLeadScore({ ...DEFAULT_SCORE_SIGNALS, emailCaptured: true });
    const withEmailAndPhone = computeLeadScore({
      ...DEFAULT_SCORE_SIGNALS,
      emailCaptured: true,
      phoneCaptured: true,
    });
    expect(withEmail).toBeGreaterThan(0);
    expect(withEmailAndPhone).toBeGreaterThan(withEmail);
  });

  it("caps conversation length's contribution rather than scaling unbounded", () => {
    const shortConvo = computeLeadScore({ ...DEFAULT_SCORE_SIGNALS, messageCount: 4 });
    const longConvo = computeLeadScore({ ...DEFAULT_SCORE_SIGNALS, messageCount: 4000 });
    // Both should be capped at the same conversation-length ceiling since
    // every other signal is at its default.
    const veryLongConvo = computeLeadScore({ ...DEFAULT_SCORE_SIGNALS, messageCount: 40 });
    expect(longConvo).toBe(veryLongConvo);
    expect(longConvo).toBeGreaterThan(shortConvo);
  });

  it("clamps out-of-range AI sub-scores instead of trusting them blindly", () => {
    const overMax: LeadScoreSignals = { ...DEFAULT_SCORE_SIGNALS, intentScore: 999 };
    const atMax: LeadScoreSignals = { ...DEFAULT_SCORE_SIGNALS, intentScore: 10 };
    expect(computeLeadScore(overMax)).toBe(computeLeadScore(atMax));

    const negative: LeadScoreSignals = { ...DEFAULT_SCORE_SIGNALS, urgencyScore: -50 };
    expect(computeLeadScore(negative)).toBe(computeLeadScore(DEFAULT_SCORE_SIGNALS));
  });

  it("support signals reduce the score rather than add to it", () => {
    const withSupport = computeLeadScore({ ...DEFAULT_SCORE_SIGNALS, intentScore: 10, supportSignalsScore: 10 });
    const withoutSupport = computeLeadScore({ ...DEFAULT_SCORE_SIGNALS, intentScore: 10 });
    expect(withSupport).toBeLessThan(withoutSupport);
  });

  it("a manual adjustment shifts the score but stays within 0..100", () => {
    const boosted = computeLeadScore({ ...DEFAULT_SCORE_SIGNALS, manualAdjustment: 30 });
    expect(boosted).toBe(30);

    const maxedOut = computeLeadScore({
      ...DEFAULT_SCORE_SIGNALS,
      emailCaptured: true,
      phoneCaptured: true,
      companyCaptured: true,
      budgetMentioned: true,
      messageCount: 100,
      intentScore: 10,
      urgencyScore: 10,
      buyingSignalsScore: 10,
      manualAdjustment: 30,
    });
    expect(maxedOut).toBe(100);

    const negativeAdjustment = computeLeadScore({ ...DEFAULT_SCORE_SIGNALS, manualAdjustment: -30 });
    expect(negativeAdjustment).toBe(0);
  });

  it("never returns a value outside [0, 100]", () => {
    const extreme: LeadScoreSignals = {
      emailCaptured: true,
      phoneCaptured: true,
      companyCaptured: true,
      messageCount: 1_000_000,
      budgetMentioned: true,
      intentScore: 10,
      urgencyScore: 10,
      buyingSignalsScore: 10,
      supportSignalsScore: 0,
      manualAdjustment: 30,
    };
    expect(computeLeadScore(extreme)).toBe(100);

    const extremeLow: LeadScoreSignals = { ...DEFAULT_SCORE_SIGNALS, manualAdjustment: -999 as number };
    expect(computeLeadScore(extremeLow)).toBe(0);
  });
});
