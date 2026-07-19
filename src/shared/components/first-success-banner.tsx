"use client";

import Link from "next/link";
import { X, CheckCircle2, BarChart3, MonitorSmartphone, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setClientFlag, useClientFlag } from "@/shared/lib/client-flag";
import type { OnboardingStatus } from "@/modules/onboarding/status";

const CHECKS = [
  { label: "Knowledge trained" },
  { label: "Widget active" },
  { label: "First conversation received" },
] as const;

const SHORTCUTS = [
  { label: "Analytics", href: "/app/analytics", icon: BarChart3 },
  { label: "Widget", href: "/app/widget", icon: MonitorSmartphone },
  { label: "Knowledge Base", href: "/app/knowledge-base", icon: BookOpen },
] as const;

function dismissedKey(organizationId: string) {
  return `bloom.onboarding.successBannerDismissed.${organizationId}`;
}

/**
 * The one-time "you made it" moment — shown in place of the setup checklist
 * once every step is genuinely complete. Purely celebratory, never blocks
 * anything: a dismiss closes it for good (client-only flag, no server state).
 */
export function FirstSuccessBanner({
  organizationId,
  status,
}: {
  organizationId: string;
  status: OnboardingStatus;
}) {
  const dismissed = useClientFlag(dismissedKey(organizationId));

  if (!status.allComplete || dismissed) {
    return null;
  }

  return (
    <section
      aria-labelledby="first-success-heading"
      className="relative overflow-hidden rounded-xl border bg-card p-5 shadow-card"
    >
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute top-3 right-3"
        aria-label="Dismiss"
        onClick={() => setClientFlag(dismissedKey(organizationId), true)}
      >
        <X className="size-4" aria-hidden="true" />
      </Button>

      <h2 id="first-success-heading" className="flex items-center gap-2 text-base font-semibold tracking-tight">
        <span aria-hidden="true">🎉</span> Your AI is live
      </h2>
      <p className="mt-1 max-w-md text-caption text-muted-foreground">
        It&rsquo;s trained, published, and just had its first real conversation with a visitor.
      </p>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {CHECKS.map((check) => (
          <li key={check.label} className="flex items-center gap-1.5 text-sm">
            <CheckCircle2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {check.label}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        {SHORTCUTS.map((shortcut) => (
          <Button
            key={shortcut.href}
            variant="outline"
            size="sm"
            render={
              <Link href={shortcut.href}>
                <shortcut.icon className="size-3.5" aria-hidden="true" />
                {shortcut.label}
              </Link>
            }
          />
        ))}
      </div>
    </section>
  );
}
