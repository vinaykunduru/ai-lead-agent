import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { VisitorProfile } from "@/db/schema";

const PROFILE_FIELDS: { key: keyof VisitorProfile; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "company", label: "Company" },
  { key: "designation", label: "Designation" },
  { key: "industry", label: "Industry" },
  { key: "website", label: "Website" },
  { key: "city", label: "City" },
  { key: "country", label: "Country" },
  { key: "interestedService", label: "Interested service" },
  { key: "requirement", label: "Requirement" },
  { key: "budget", label: "Budget" },
  { key: "timeline", label: "Timeline" },
  { key: "teamSize", label: "Team size" },
  { key: "currentSolution", label: "Current solution" },
  { key: "preferredContactTime", label: "Preferred contact time" },
];

/**
 * The Lead Detail sidebar's "how much do we know about this visitor" panel
 * (module spec: Progressive Profile Enrichment — "show completion %"). Same
 * 16 identity/qualification fields the background extraction pass
 * (modules/conversation/extraction/stage2.ts) and prompt guidance
 * (modules/ai-behaviour/prompt-generator.ts's describeKnownVisitorFields)
 * both write to, kept as an independent list here since this is a UI
 * concern (labels/layout), not prompt-assembly logic.
 */
export function VisitorProfilePanel({ profile, viewHref }: { profile: VisitorProfile; viewHref: string }) {
  const known = PROFILE_FIELDS.filter((field) => Boolean(profile[field.key]));
  const percent = Math.round((known.length / PROFILE_FIELDS.length) * 100);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">Visitor profile</CardTitle>
        <Button variant="ghost" size="sm" render={<Link href={viewHref}>View full profile <ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-baseline justify-between gap-2 text-caption text-muted-foreground">
            <span>Profile completeness</span>
            <span>{percent}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Visitor profile completeness"
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        {known.length > 0 ? (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            {known.map((field) => (
              <div key={field.key} className="min-w-0">
                <dt className="text-caption text-muted-foreground">{field.label}</dt>
                <dd className="truncate">{String(profile[field.key])}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nothing captured from this visitor yet — the AI asks naturally as the conversation progresses.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
