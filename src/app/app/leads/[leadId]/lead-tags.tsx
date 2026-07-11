"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeadTag } from "@/db/schema";

export function LeadTags({ leadId, initialTags, canUpdate }: { leadId: string; initialTags: LeadTag[]; canUpdate: boolean }) {
  const router = useRouter();
  const [tags, setTags] = useState(initialTags);
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);

  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    const tag = value.trim();
    if (!tag) return;
    setPending(true);
    const res = await fetch(`/api/leads/${leadId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tag }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not add tag");
      return;
    }
    const { tag: created } = await res.json();
    setTags((prev) => [...prev, created]);
    setValue("");
    router.refresh();
  }

  async function removeTag(tagId: string) {
    const res = await fetch(`/api/leads/${leadId}/tags/${tagId}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not remove tag");
      return;
    }
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Tags</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {tags.length === 0 ? <p className="text-sm text-muted-foreground">No tags yet.</p> : null}
          {tags.map((tag) => (
            <Badge key={tag.id} variant="outline" className="gap-1">
              {tag.tag}
              {canUpdate ? (
                <button type="button" onClick={() => removeTag(tag.id)} className="ml-0.5 text-muted-foreground hover:text-foreground">
                  ✕
                </button>
              ) : null}
            </Badge>
          ))}
        </div>
        {canUpdate ? (
          <form onSubmit={addTag} className="flex gap-2">
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Add a tag" maxLength={40} className="flex-1" />
            <Button type="submit" size="sm" disabled={pending}>Add</Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
