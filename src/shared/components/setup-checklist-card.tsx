"use client";

import { useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Rocket, Bot, BookOpen, MonitorSmartphone, MessagesSquare, Building2, type LucideIcon } from "lucide-react";
import { ChecklistList, type ChecklistItem } from "@/shared/components/checklist-list";
import { setClientFlag, useClientFlag } from "@/shared/lib/client-flag";
import type { OnboardingStatus, OnboardingStepId } from "@/modules/onboarding/status";

type StepMeta = {
  label: string;
  icon: LucideIcon;
  href?: string;
};

const STEP_META: Record<OnboardingStepId, StepMeta> = {
  company: { label: "Create Company", icon: Building2 },
  ai: { label: "Configure AI", icon: Bot, href: "/app/ai-behaviour" },
  knowledge: { label: "Import Knowledge", icon: BookOpen, href: "/app/knowledge-base" },
  widget: { label: "Customize Widget", icon: MonitorSmartphone, href: "/app/widget" },
  conversation: { label: "Test Conversation", icon: MessagesSquare, href: "/app/conversations" },
  goLive: { label: "Go Live", icon: Rocket },
};

function completedOnceKey(organizationId: string) {
  return `bloom.onboarding.completedOnce.${organizationId}`;
}

function tagline(status: OnboardingStatus): string | null {
  if (status.completedCount <= 1) {
    return "Let's get your AI ready in just a few minutes.";
  }
  if (status.completedCount === status.totalCount - 1) {
    return "You're almost ready to launch.";
  }
  return null;
}

export function SetupChecklistCard({
  organizationId,
  status,
}: {
  organizationId: string;
  status: OnboardingStatus;
}) {
  const completedOnce = useClientFlag(completedOnceKey(organizationId));

  useEffect(() => {
    // Runs once, the first render after the last step completes — remembers
    // that this org has finished onboarding so the card stays gone even if a
    // later action (e.g. archiving the widget) makes a step look incomplete
    // again. No server flag: this is a client-only "don't re-show" memory.
    // Same transition also fires the one-time "you're live" toast — this is
    // the exact moment, never re-triggered by a later reload.
    if (status.allComplete && !completedOnce) {
      setClientFlag(completedOnceKey(organizationId), true);
      toast.success("🎉 Your AI is live!", {
        description: "It's trained, your widget is active, and it just had its first real conversation.",
        duration: 6000,
      });
    }
  }, [status.allComplete, completedOnce, organizationId]);

  if (status.allComplete || completedOnce) {
    return null;
  }

  const percent = Math.round((status.completedCount / status.totalCount) * 100);
  const nextStep = status.steps.find((step) => !step.complete && STEP_META[step.id].href);
  const note = tagline(status);

  return (
    <section
      aria-labelledby="setup-checklist-heading"
      className="overflow-hidden rounded-xl border bg-card shadow-card"
    >
      <div className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="setup-checklist-heading" className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <span aria-hidden="true">🚀</span> Complete your setup
          </h2>
          <p className="text-caption text-muted-foreground">
            {status.completedCount} of {status.totalCount} completed
          </p>
        </div>

        {note ? <p className="mt-1 text-caption text-muted-foreground">{note}</p> : null}

        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Setup progress"
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>

        {status.estimatedMinutesRemaining > 0 ? (
          <p className="mt-2 text-caption text-muted-foreground">
            Estimated time remaining: ~{status.estimatedMinutesRemaining} min
          </p>
        ) : null}

        <ChecklistList
          items={status.steps.map(
            (step): ChecklistItem => ({
              id: step.id,
              label: STEP_META[step.id].label,
              complete: step.complete,
              icon: STEP_META[step.id].icon,
              href: STEP_META[step.id].href,
            }),
          )}
        />

        {nextStep ? (
          <Link
            href={STEP_META[nextStep.id].href!}
            className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:rounded-sm"
          >
            Continue setup <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
