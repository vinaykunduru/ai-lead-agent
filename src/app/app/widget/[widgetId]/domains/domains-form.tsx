"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/shared/components/empty-state";
import type { WidgetDomain } from "@/db/schema";

type EditableDomain = { tempId: string; id?: string; domain: string; isEnabled: boolean };

function blankDomain(): EditableDomain {
  return { tempId: crypto.randomUUID(), domain: "", isEnabled: true };
}

export function DomainsForm({
  widgetId,
  initialDomains,
  canUpdate,
}: {
  widgetId: string;
  initialDomains: WidgetDomain[];
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [domains, setDomains] = useState<EditableDomain[]>(
    initialDomains.map((d) => ({ tempId: d.id, id: d.id, domain: d.domain, isEnabled: d.isEnabled })),
  );
  const [pending, setPending] = useState(false);

  function update(tempId: string, patch: Partial<EditableDomain>) {
    setDomains((prev) => prev.map((d) => (d.tempId === tempId ? { ...d, ...patch } : d)));
  }

  function remove(tempId: string) {
    setDomains((prev) => prev.filter((d) => d.tempId !== tempId));
  }

  async function save() {
    for (const d of domains) {
      if (!d.domain.trim()) {
        toast.error("Every domain entry needs a value");
        return;
      }
    }

    setPending(true);
    const res = await fetch(`/api/widgets/${widgetId}/domains`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domains: domains.map((d) => ({
          ...(d.id ? { id: d.id } : {}),
          domain: d.domain.trim(),
          isEnabled: d.isEnabled,
        })),
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not save domains");
      return;
    }
    toast.success("Domains updated");
    router.refresh();
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Allowed domains</CardTitle>
        <p className="text-sm text-muted-foreground">
          Only these domains may embed this widget. With no domains configured, the widget accepts
          requests from any origin — add at least one to restrict it.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {domains.length === 0 ? (
          <EmptyState
            title="No domains configured"
            description="This widget is currently embeddable from any site. Add a domain to restrict it."
          />
        ) : (
          domains.map((d) => (
            <div key={d.tempId} className="flex items-center gap-2">
              <Switch
                checked={d.isEnabled}
                onCheckedChange={(checked) => update(d.tempId, { isEnabled: checked })}
                disabled={!canUpdate}
              />
              <Input
                disabled={!canUpdate}
                value={d.domain}
                placeholder="example.com"
                onChange={(e) => update(d.tempId, { domain: e.target.value })}
              />
              {canUpdate ? (
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(d.tempId)}>
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          ))
        )}

        {canUpdate ? (
          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDomains((prev) => [...prev, blankDomain()])}
            >
              <Plus className="size-4" />
              Add domain
            </Button>
            <Button type="button" loading={pending} onClick={save}>
              Save changes
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
