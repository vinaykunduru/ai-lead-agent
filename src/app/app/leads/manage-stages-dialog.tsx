"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { LeadStage } from "@/db/schema";

type StageDraft = { id?: string; name: string; isWon: boolean; isLost: boolean };

export function ManageStagesDialog({ stages }: { stages: LeadStage[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [draft, setDraft] = useState<StageDraft[]>(
    stages.map((s) => ({ id: s.id, name: s.name, isWon: s.isWon, isLost: s.isLost })),
  );

  function update(index: number, patch: Partial<StageDraft>) {
    setDraft((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function remove(index: number) {
    setDraft((prev) => prev.filter((_, i) => i !== index));
  }

  function add() {
    setDraft((prev) => [...prev, { name: "", isWon: false, isLost: false }]);
  }

  async function save() {
    const stagesToSave = draft.filter((s) => s.name.trim().length > 0);
    if (stagesToSave.length === 0) {
      toast.error("Keep at least one stage");
      return;
    }
    setPending(true);
    const res = await fetch("/api/leads/stages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stages: stagesToSave.map((s) => ({ ...s, name: s.name.trim() })) }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not save stages");
      return;
    }
    toast.success("Pipeline updated");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm">Manage stages</Button>} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Pipeline stages</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {draft.map((stage, index) => (
            <div key={stage.id ?? `new-${index}`} className="flex items-center gap-2">
              <Input
                value={stage.name}
                onChange={(e) => update(index, { name: e.target.value })}
                placeholder="Stage name"
                className="flex-1"
              />
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <Checkbox
                  checked={stage.isWon}
                  onCheckedChange={(checked) => update(index, { isWon: Boolean(checked), isLost: false })}
                />
                Won
              </label>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <Checkbox
                  checked={stage.isLost}
                  onCheckedChange={(checked) => update(index, { isLost: Boolean(checked), isWon: false })}
                />
                Lost
              </label>
              <Button variant="ghost" size="icon-sm" onClick={() => remove(index)}>
                ✕
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={add}>Add stage</Button>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving..." : "Save pipeline"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
