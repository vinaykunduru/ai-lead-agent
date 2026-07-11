"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WORKING_DAYS } from "@/modules/ai-behaviour/validation";
import type { AiBusinessHours } from "@/db/schema";

const DAY_LABELS: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export function BusinessHoursForm({
  businessHours,
  canUpdate,
}: {
  businessHours: AiBusinessHours;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [workingDays, setWorkingDays] = useState<string[]>(
    Array.isArray(businessHours.workingDays) ? (businessHours.workingDays as string[]) : [],
  );
  const [startTime, setStartTime] = useState(businessHours.startTime);
  const [endTime, setEndTime] = useState(businessHours.endTime);
  const [timezone, setTimezone] = useState(businessHours.timezone);
  const [holidayMode, setHolidayMode] = useState(businessHours.holidayMode);
  const [outsideHoursResponse, setOutsideHoursResponse] = useState(businessHours.outsideHoursResponse ?? "");
  const [pending, setPending] = useState(false);

  function toggleDay(day: string) {
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function save() {
    setPending(true);
    const res = await fetch("/api/ai-behaviour/business-hours", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workingDays,
        startTime,
        endTime,
        timezone,
        holidayMode,
        outsideHoursResponse: outsideHoursResponse.trim() || null,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not save business hours");
      return;
    }
    toast.success("Business hours updated");
    router.refresh();
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Business hours</CardTitle>
        <p className="text-sm text-muted-foreground">When your AI Assistant is considered &ldquo;in hours.&rdquo;</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Working days</Label>
          <div className="flex flex-wrap gap-4">
            {WORKING_DAYS.map((day) => (
              <label key={day} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={workingDays.includes(day)}
                  onCheckedChange={() => toggleDay(day)}
                  disabled={!canUpdate}
                />
                {DAY_LABELS[day]}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startTime">Start time</Label>
            <Input
              id="startTime"
              type="time"
              disabled={!canUpdate}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="endTime">End time</Label>
            <Input
              id="endTime"
              type="time"
              disabled={!canUpdate}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Input
            id="timezone"
            placeholder="e.g. America/New_York"
            disabled={!canUpdate}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-between">
          <Label htmlFor="holidayMode">Holiday mode</Label>
          <Switch id="holidayMode" checked={holidayMode} onCheckedChange={setHolidayMode} disabled={!canUpdate} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="outsideHoursResponse">Outside business hours response</Label>
          <Textarea
            id="outsideHoursResponse"
            rows={3}
            placeholder="e.g. We're offline right now — leave a message and we'll get back to you."
            disabled={!canUpdate}
            value={outsideHoursResponse}
            onChange={(e) => setOutsideHoursResponse(e.target.value)}
          />
        </div>

        {canUpdate ? (
          <Button type="button" disabled={pending} onClick={save}>
            {pending ? "Saving..." : "Save changes"}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
