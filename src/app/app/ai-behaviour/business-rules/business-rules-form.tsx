"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/shared/components/empty-state";
import type { AiBusinessRule } from "@/db/schema";

type EditableRule = { tempId: string; id?: string; text: string; isEnabled: boolean };

function blankRule(): EditableRule {
  return { tempId: crypto.randomUUID(), text: "", isEnabled: true };
}

const EXAMPLES = [
  "Never discuss competitors",
  "Never promise discounts",
  "Never provide legal advice",
  "Never provide medical advice",
  "Never answer outside company knowledge",
  "Always recommend contacting support if uncertain",
];

export function BusinessRulesForm({
  initialRules,
  canUpdate,
}: {
  initialRules: AiBusinessRule[];
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [rules, setRules] = useState<EditableRule[]>(
    initialRules.map((r) => ({ tempId: r.id, id: r.id, text: r.text, isEnabled: r.isEnabled })),
  );
  const [pending, setPending] = useState(false);

  function update(tempId: string, patch: Partial<EditableRule>) {
    setRules((prev) => prev.map((r) => (r.tempId === tempId ? { ...r, ...patch } : r)));
  }

  function remove(tempId: string) {
    setRules((prev) => prev.filter((r) => r.tempId !== tempId));
  }

  function move(tempId: string, direction: -1 | 1) {
    setRules((prev) => {
      const index = prev.findIndex((r) => r.tempId === tempId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    for (const r of rules) {
      if (!r.text.trim()) {
        toast.error("Every rule needs text");
        return;
      }
    }

    setPending(true);
    const res = await fetch("/api/ai-behaviour/business-rules", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rules: rules.map((r) => ({
          ...(r.id ? { id: r.id } : {}),
          text: r.text.trim(),
          isEnabled: r.isEnabled,
        })),
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not save business rules");
      return;
    }
    toast.success("Business rules updated");
    router.refresh();
  }

  return (
    <div className="max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Business rules</CardTitle>
          <p className="text-sm text-muted-foreground">
            Rules your AI Assistant always follows, e.g. &ldquo;{EXAMPLES[0]}&rdquo; or &ldquo;{EXAMPLES[1]}
            &rdquo;.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {rules.length === 0 ? (
            <EmptyState title="No rules yet" description="Add a rule below to get started." />
          ) : (
            rules.map((r, index) => (
              <div key={r.tempId} className="flex items-start gap-2">
                <Switch
                  className="mt-2"
                  checked={r.isEnabled}
                  onCheckedChange={(checked) => update(r.tempId, { isEnabled: checked })}
                  disabled={!canUpdate}
                />
                <Input
                  disabled={!canUpdate}
                  value={r.text}
                  placeholder="e.g. Never discuss competitors"
                  onChange={(e) => update(r.tempId, { text: e.target.value })}
                />
                {canUpdate ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === 0}
                      onClick={() => move(r.tempId, -1)}
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === rules.length - 1}
                      onClick={() => move(r.tempId, 1)}
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(r.tempId)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
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
                onClick={() => setRules((prev) => [...prev, blankRule()])}
              >
                <Plus className="size-4" />
                Add rule
              </Button>
              <Button type="button" disabled={pending} onClick={save}>
                {pending ? "Saving..." : "Save changes"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
