import "server-only";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { getMyOrganization } from "@/modules/organizations/service";
import { getAiProfile } from "@/modules/ai-behaviour/profile-service";
import { listDocuments } from "@/modules/knowledge/documents-service";
import { listWidgets } from "@/modules/widget/widgets-service";
import { listConversations } from "@/modules/conversation/inspector-service";

export type OnboardingStepId = "company" | "ai" | "knowledge" | "widget" | "conversation" | "goLive";

export type OnboardingStep = {
  id: OnboardingStepId;
  complete: boolean;
  /** False if the viewer's role can't act on this step at all (e.g. a viewer can't create a widget). */
  actionable: boolean;
};

export type OnboardingStatus = {
  /** True once every step is complete — gates the welcome screen and the checklist's own visibility. */
  allComplete: boolean;
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  /** Rough estimate only, derived from how many real setup actions remain — never persisted, always recomputed. */
  estimatedMinutesRemaining: number;
};

/** Real setup work, one entry per step a person actually has to go do something for. */
const MINUTES_PER_ACTIONABLE_STEP = 2.5;
const ACTIONABLE_STEP_IDS: OnboardingStepId[] = ["ai", "knowledge", "widget", "conversation"];

/**
 * Every signal here is read from data that already exists for other reasons
 * (widgets, knowledge documents, the AI profile, conversations) — this
 * derives onboarding progress, it never stores it. There is no onboarding
 * table; "done" is inferred from real usage, so it can never drift out of
 * sync with what the org has actually done.
 */
export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const session = await requireCompanySession();

  const [organization, widgets, documents, conversations, aiProfile] = await Promise.all([
    getMyOrganization(),
    can(session, "widget.view") ? listWidgets() : Promise.resolve([]),
    can(session, "knowledge.view") ? listDocuments() : Promise.resolve([]),
    can(session, "conversations.view") ? listConversations() : Promise.resolve([]),
    can(session, "ai.view") ? getAiProfile() : Promise.resolve(null),
  ]);

  const aiConfigured = aiProfile
    ? // Both timestamps come from the same `now()` call in the seeding insert,
      // so any drift means an explicit update happened later.
      aiProfile.updatedAt.getTime() !== aiProfile.createdAt.getTime()
    : false;
  const knowledgeReady = documents.some((doc) => doc.status === "ready");
  const widgetConfigured = widgets.length > 0;
  const conversationTested = conversations.length > 0;
  const goLiveReady = aiConfigured && knowledgeReady && widgetConfigured && conversationTested;

  const steps: OnboardingStep[] = [
    { id: "company", complete: Boolean(organization), actionable: false },
    { id: "ai", complete: aiConfigured, actionable: can(session, "ai.update") },
    { id: "knowledge", complete: knowledgeReady, actionable: can(session, "knowledge.create") },
    { id: "widget", complete: widgetConfigured, actionable: can(session, "widget.create") },
    { id: "conversation", complete: conversationTested, actionable: false },
    { id: "goLive", complete: goLiveReady, actionable: false },
  ];

  const completedCount = steps.filter((step) => step.complete).length;
  const remainingActionableSteps = steps.filter(
    (step) => ACTIONABLE_STEP_IDS.includes(step.id) && !step.complete,
  ).length;

  return {
    allComplete: steps.every((step) => step.complete),
    steps,
    completedCount,
    totalCount: steps.length,
    estimatedMinutesRemaining: Math.max(0, Math.round(remainingActionableSteps * MINUTES_PER_ACTIONABLE_STEP)),
  };
}
