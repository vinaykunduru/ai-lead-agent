"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/shared/components/empty-state";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ANALYTICS_ALERT_METRICS, ANALYTICS_ALERT_OPERATORS } from "@/modules/analytics/validation";
import type { AlertStatus } from "@/modules/analytics/alerts-service";

const METRIC_LABELS: Record<(typeof ANALYTICS_ALERT_METRICS)[number], string> = {
  failure_rate: "AI failure rate (%)",
  avg_latency_ms: "Average AI latency (ms)",
  no_match_rate: "Knowledge no-match rate (%)",
  escalation_rate: "Escalation rate (%)",
  bounce_rate: "Widget bounce rate (%)",
};

const OPERATOR_LABELS: Record<(typeof ANALYTICS_ALERT_OPERATORS)[number], string> = {
  gt: "is above",
  gte: "is at least",
  lt: "is below",
  lte: "is at most",
};

export function AlertsClient({ initialRules }: { initialRules: AlertStatus[] }) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleEnabled(rule: AlertStatus) {
    setBusyId(rule.id);
    const res = await fetch(`/api/analytics/alerts/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    setBusyId(null);
    if (!res.ok) {
      toast.error("Could not update the alert");
      return;
    }
    router.refresh();
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: !rule.enabled } : r)));
  }

  async function remove(ruleId: string) {
    setBusyId(ruleId);
    const res = await fetch(`/api/analytics/alerts/${ruleId}`, { method: "DELETE" });
    setBusyId(null);
    if (!res.ok) {
      toast.error("Could not delete the alert");
      return;
    }
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    toast.success("Alert deleted");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Configurable thresholds evaluated over the trailing 24 hours. No email/push delivery — check back here to
          see what&apos;s currently breached.
        </p>
        <CreateAlertDialog
          onCreated={(rule) => {
            setRules((prev) => [...prev, { ...rule, currentValue: 0, breached: false }]);
            router.refresh();
          }}
        />
      </div>

      {rules.length === 0 ? (
        <EmptyState title="No alerts configured" description="Add a threshold to get notified when a metric drifts." />
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <Card key={rule.id}>
              <CardContent className="flex items-center justify-between gap-4 pt-6">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{rule.name}</p>
                    {rule.enabled && rule.breached ? <Badge variant="destructive">Breached</Badge> : null}
                    {!rule.enabled ? <Badge variant="outline">Disabled</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {METRIC_LABELS[rule.metric]} {OPERATOR_LABELS[rule.operator]} {Number(rule.threshold)}
                    {rule.enabled ? ` — currently ${rule.currentValue}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={rule.enabled}
                    disabled={busyId === rule.id}
                    onCheckedChange={() => toggleEnabled(rule)}
                  />
                  <Button
                    variant="destructive"
                    size="sm"
                    loading={busyId === rule.id}
                    onClick={() => remove(rule.id)}
                  >
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function CreateAlertDialog({ onCreated }: { onCreated: (rule: AlertStatus) => void }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [metric, setMetric] = useState<(typeof ANALYTICS_ALERT_METRICS)[number]>("failure_rate");
  const [operator, setOperator] = useState<(typeof ANALYTICS_ALERT_OPERATORS)[number]>("gt");

  async function submit(formData: FormData) {
    const name = String(formData.get("name") ?? "").trim();
    const threshold = Number(formData.get("threshold"));
    if (!name || !Number.isFinite(threshold)) {
      toast.error("Enter a name and a valid threshold");
      return;
    }

    setPending(true);
    const res = await fetch("/api/analytics/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, metric, operator, threshold, enabled: true }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not create the alert");
      return;
    }
    const { rule } = await res.json();
    onCreated(rule);
    toast.success("Alert created");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm">New alert</Button>} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New alert</DialogTitle>
        </DialogHeader>
        <form action={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="alert-name">Name</Label>
            <Input id="alert-name" name="name" maxLength={100} placeholder="High failure rate" required />
          </div>
          <div className="space-y-2">
            <Label>Metric</Label>
            <Select value={metric} onValueChange={(v) => v && setMetric(v as typeof metric)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ANALYTICS_ALERT_METRICS.map((m) => (
                  <SelectItem key={m} value={m}>{METRIC_LABELS[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Condition</Label>
              <Select value={operator} onValueChange={(v) => v && setOperator(v as typeof operator)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANALYTICS_ALERT_OPERATORS.map((o) => (
                    <SelectItem key={o} value={o}>{OPERATOR_LABELS[o]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="alert-threshold">Threshold</Label>
              <Input id="alert-threshold" name="threshold" type="number" step="any" required />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" loading={pending}>Create alert</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
