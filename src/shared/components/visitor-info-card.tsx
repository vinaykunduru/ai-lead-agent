import Link from "next/link";
import { User, Phone, Mail, Building2, MapPin, ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Lead, VisitorProfile } from "@/db/schema";

const QUALIFICATION_TONE = {
  hot: "destructive",
  warm: "warning",
  cold: "secondary",
} as const;

function scoreTone(score: number) {
  if (score >= 70) return "success" as const;
  if (score >= 40) return "warning" as const;
  return "outline" as const;
}

/**
 * Shared "who is this" panel — used on Conversation Detail, Inbox Detail,
 * and Lead Detail (module spec §10/§11) so all three read the same fields
 * the same way. Editing happens on the Customer 360 page (`viewHref`), not
 * inline here, to avoid three separate edit forms for the same data.
 */
export function VisitorInfoCard({
  profile,
  lead,
  viewHref,
}: {
  profile: VisitorProfile;
  lead: Lead | null;
  viewHref: string;
}) {
  const missing = [
    !profile.name && "Name",
    !profile.phone && "Mobile number",
    !profile.email && "Email",
    !profile.company && "Company",
  ].filter((v): v is string => Boolean(v));

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">Visitor information</CardTitle>
        <Button variant="ghost" size="sm" render={<Link href={viewHref}>View full profile <ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>} />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Avatar size="lg">
            <AvatarFallback>
              <User className="size-4" aria-hidden="true" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{profile.name ?? "Unknown visitor"}</p>
            {profile.designation || profile.company ? (
              <p className="truncate text-caption text-muted-foreground">
                {[profile.designation, profile.company].filter(Boolean).join(" at ")}
              </p>
            ) : null}
          </div>
          {lead ? (
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Badge variant={scoreTone(lead.score)}>Score {lead.score}</Badge>
              {lead.qualificationStatus ? (
                <Badge variant={QUALIFICATION_TONE[lead.qualificationStatus]} className="capitalize">
                  {lead.qualificationStatus}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="size-3.5 shrink-0" aria-hidden="true" />
            {profile.phone ?? <span className="italic">Not provided</span>}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="size-3.5 shrink-0" aria-hidden="true" />
            {profile.email ?? <span className="italic">Not provided</span>}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="size-3.5 shrink-0" aria-hidden="true" />
            {profile.industry ?? <span className="italic">Industry unknown</span>}
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            {[profile.city, profile.country].filter(Boolean).join(", ") || <span className="italic">Location unknown</span>}
          </div>
        </div>

        {profile.conversationSummary ? (
          <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">{profile.conversationSummary}</p>
        ) : null}

        {missing.length > 0 ? (
          <p className="text-caption text-muted-foreground">
            Missing:{" "}
            {missing.map((field, index) => (
              <span key={field}>
                <span className="font-medium text-foreground">{field}</span>
                {index < missing.length - 1 ? ", " : ""}
              </span>
            ))}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
