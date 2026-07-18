import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAiProfile } from "@/modules/ai-behaviour/profile-service";
import { listBusinessRules } from "@/modules/ai-behaviour/business-rules-service";
import { listLeadQuestions } from "@/modules/ai-behaviour/lead-questions-service";
import { getBusinessHours } from "@/modules/ai-behaviour/business-hours-service";
import { getHandoffSettings } from "@/modules/ai-behaviour/handoff-service";

const PERSONALITY_LABELS: Record<string, string> = {
  professional: "Professional",
  friendly: "Friendly",
  technical: "Technical",
  luxury: "Luxury",
  healthcare: "Healthcare",
  legal: "Legal",
  sales: "Sales",
  custom: "Custom",
};

export default async function AiBehaviourOverviewPage() {
  const [profile, businessRules, leadQuestions, businessHours, handoff] = await Promise.all([
    getAiProfile(),
    listBusinessRules(),
    listLeadQuestions(),
    getBusinessHours(),
    getHandoffSettings(),
  ]);

  const enabledRules = businessRules.filter((r) => r.isEnabled).length;

  const cards = [
    {
      title: "Identity",
      href: "/app/ai-behaviour/identity",
      summary: `${profile.assistantName}${profile.role ? ` — ${profile.role}` : ""}`,
    },
    {
      title: "Personality",
      href: "/app/ai-behaviour/personality",
      summary: PERSONALITY_LABELS[profile.personalityType] ?? profile.personalityType,
    },
    {
      title: "Language",
      href: "/app/ai-behaviour/language",
      summary: `Primary: ${profile.primaryLanguage.toUpperCase()}${profile.autoDetectLanguage ? " · auto-detect on" : ""}`,
    },
    {
      title: "Lead Qualification",
      href: "/app/ai-behaviour/lead-qualification",
      summary: `${leadQuestions.length} question${leadQuestions.length === 1 ? "" : "s"}`,
    },
    {
      title: "Business Rules",
      href: "/app/ai-behaviour/business-rules",
      summary: `${enabledRules} active rule${enabledRules === 1 ? "" : "s"}`,
    },
    {
      title: "Business Hours",
      href: "/app/ai-behaviour/business-hours",
      summary: businessHours.holidayMode
        ? "Holiday mode on"
        : `${businessHours.startTime}–${businessHours.endTime} (${businessHours.timezone})`,
    },
    {
      title: "Handoff",
      href: "/app/ai-behaviour/handoff",
      summary: handoff.escalationEnabled ? "Escalation enabled" : "Escalation disabled",
    },
    {
      title: "Safety",
      href: "/app/ai-behaviour/safety",
      summary: "Platform guardrails always active",
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Everything below configures how {profile.assistantName} behaves. This does not build the live
          chat experience — use the Playground to preview configuration.
        </p>
        <Button render={<Link href="/app/ai-behaviour/playground">Open Playground</Link>} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.href} interactive className="h-full">
            <Link href={card.href} className="block h-full focus-visible:outline-none">
              <CardHeader>
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{card.summary}</p>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
