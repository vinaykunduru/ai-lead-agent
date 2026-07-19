"use client";

import { useSyncExternalStore } from "react";
import Image from "next/image";
import { Bot, BookOpen, MonitorSmartphone, Rocket, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

const JOURNEY = [
  { label: "Configure your AI", icon: Bot },
  { label: "Train it on your content", icon: BookOpen },
  { label: "Customize your widget", icon: MonitorSmartphone },
  { label: "Install on your site", icon: Rocket },
  { label: "Have your first conversation", icon: MessagesSquare },
] as const;

const DISMISS_EVENT = "bloom:onboarding-welcome-dismissed";

function dismissedKey(organizationId: string) {
  return `bloom.onboarding.welcomeDismissed.${organizationId}`;
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener(DISMISS_EVENT, onStoreChange);
  return () => window.removeEventListener(DISMISS_EVENT, onStoreChange);
}

function dismiss(organizationId: string) {
  window.localStorage.setItem(dismissedKey(organizationId), "true");
  window.dispatchEvent(new Event(DISMISS_EVENT));
}

/**
 * Shown once per organization, in place of the dashboard, until the owner
 * dismisses it. There's no "onboarding seen" column anywhere — dismissal
 * lives in localStorage on purpose, so this stays a pure frontend concern
 * with no new backend surface.
 */
export function WelcomeScreen({
  organizationId,
  organizationName,
  children,
}: {
  organizationId: string;
  organizationName: string;
  children: React.ReactNode;
}) {
  const dismissed = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(dismissedKey(organizationId)) === "true",
    // Server + first client render assume "dismissed" so there's no flash of
    // the welcome screen before we know better — it can only turn on after
    // hydration, once we've actually read localStorage.
    () => true,
  );

  if (dismissed) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center p-6">
      <div className="w-full max-w-lg text-center">
        <Image src="/logo.png" alt="" width={56} height={56} className="mx-auto mb-6 rounded-xl" />

        <h1 className="font-heading text-page-title font-bold text-foreground">
          Welcome to Bloom, {organizationName}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-body text-muted-foreground">
          Bloom turns your website into a 24/7 AI sales rep — answering visitor questions from your own
          content and turning conversations into qualified leads.
        </p>
        <p className="mt-4 text-caption font-medium text-muted-foreground">
          Estimated setup time: about 10 minutes
        </p>

        <ol className="mx-auto mt-8 flex max-w-md flex-col gap-2.5 text-left">
          {JOURNEY.map((step, index) => (
            <li
              key={step.label}
              className="flex items-center gap-3 rounded-lg border bg-card px-3.5 py-2.5 shadow-card"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-caption font-semibold text-primary">
                {index + 1}
              </span>
              <step.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium">{step.label}</span>
            </li>
          ))}
        </ol>

        <Button size="lg" className="mt-8" onClick={() => dismiss(organizationId)}>
          Get started
        </Button>
      </div>
    </div>
  );
}
