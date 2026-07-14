"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/shared/components/empty-state";
import { LEAD_QUESTION_VALIDATION_TYPES } from "@/modules/ai-behaviour/validation";
import type { AiLeadQuestion } from "@/db/schema";

type EditableQuestion = {
  tempId: string;
  id?: string;
  fieldKey: string;
  label: string;
  isRequired: boolean;
  placeholder: string;
  validationType: (typeof LEAD_QUESTION_VALIDATION_TYPES)[number];
};

function fromServer(question: AiLeadQuestion): EditableQuestion {
  return {
    tempId: question.id,
    id: question.id,
    fieldKey: question.fieldKey,
    label: question.label,
    isRequired: question.isRequired,
    placeholder: question.placeholder ?? "",
    validationType: question.validationType,
  };
}

function blankQuestion(): EditableQuestion {
  return {
    tempId: crypto.randomUUID(),
    fieldKey: "",
    label: "",
    isRequired: true,
    placeholder: "",
    validationType: "none",
  };
}

export function LeadQuestionsForm({
  initialQuestions,
  canUpdate,
}: {
  initialQuestions: AiLeadQuestion[];
  canUpdate: boolean;
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState<EditableQuestion[]>(initialQuestions.map(fromServer));
  const [pending, setPending] = useState(false);

  function update(tempId: string, patch: Partial<EditableQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.tempId === tempId ? { ...q, ...patch } : q)));
  }

  function remove(tempId: string) {
    setQuestions((prev) => prev.filter((q) => q.tempId !== tempId));
  }

  function move(tempId: string, direction: -1 | 1) {
    setQuestions((prev) => {
      const index = prev.findIndex((q) => q.tempId === tempId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function save() {
    for (const q of questions) {
      if (!q.fieldKey.trim() || !q.label.trim()) {
        toast.error("Every question needs a field key and a label");
        return;
      }
    }

    setPending(true);
    const res = await fetch("/api/ai-behaviour/lead-questions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questions: questions.map((q) => ({
          ...(q.id ? { id: q.id } : {}),
          fieldKey: q.fieldKey.trim(),
          label: q.label.trim(),
          isRequired: q.isRequired,
          placeholder: q.placeholder.trim() || null,
          validationType: q.validationType,
        })),
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not save qualification questions");
      return;
    }
    toast.success("Qualification questions updated");
    router.refresh();
  }

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Lead qualification</CardTitle>
          <p className="text-sm text-muted-foreground">
            Questions your AI Assistant asks to qualify a visitor — order matters.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {questions.length === 0 ? (
            <EmptyState title="No questions yet" description="Add a question below to get started." />
          ) : (
            questions.map((q, index) => (
              <div key={q.tempId} className="space-y-3 rounded-lg border p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Label</Label>
                    <Input
                      placeholder="e.g. Email"
                      disabled={!canUpdate}
                      value={q.label}
                      onChange={(e) => update(q.tempId, { label: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Field key</Label>
                    <Input
                      placeholder="e.g. email"
                      disabled={!canUpdate}
                      value={q.fieldKey}
                      onChange={(e) => update(q.tempId, { fieldKey: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Placeholder</Label>
                    <Input
                      placeholder="e.g. you@company.com"
                      disabled={!canUpdate}
                      value={q.placeholder}
                      onChange={(e) => update(q.tempId, { placeholder: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Validation</Label>
                    <Select
                      value={q.validationType}
                      onValueChange={(v) => update(q.tempId, { validationType: (v ?? "none") as EditableQuestion["validationType"] })}
                      disabled={!canUpdate}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAD_QUESTION_VALIDATION_TYPES.map((type) => (
                          <SelectItem key={type} value={type} className="capitalize">
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={q.isRequired}
                      onCheckedChange={(checked) => update(q.tempId, { isRequired: checked })}
                      disabled={!canUpdate}
                    />
                    <Label>Required</Label>
                  </div>
                  {canUpdate ? (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === 0}
                        onClick={() => move(q.tempId, -1)}
                      >
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={index === questions.length - 1}
                        onClick={() => move(q.tempId, 1)}
                      >
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-sm" onClick={() => remove(q.tempId)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}

          {canUpdate ? (
            <div className="flex items-center justify-between pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuestions((prev) => [...prev, blankQuestion()])}
              >
                <Plus className="size-4" />
                Add question
              </Button>
              <Button type="button" loading={pending} onClick={save}>
                Save changes
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
