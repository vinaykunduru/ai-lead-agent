"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LeadNote } from "@/db/schema";

/** Internal only — never rendered anywhere a visitor or the widget can reach. */
export function LeadNotes({ leadId, initialNotes, canUpdate }: { leadId: string; initialNotes: LeadNote[]; canUpdate: boolean }) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text) return;
    setPending(true);
    const res = await fetch(`/api/leads/${leadId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not add note");
      return;
    }
    const { note } = await res.json();
    setNotes((prev) => [...prev, note]);
    setContent("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Internal notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No internal notes yet. Never visible to the visitor.</p>
        ) : (
          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="rounded-md border p-2.5">
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">{note.createdAt.toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
        {canUpdate ? (
          <form onSubmit={addNote} className="space-y-2">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add an internal note (never visible to the visitor)..."
              rows={3}
              maxLength={5000}
            />
            <Button type="submit" size="sm" loading={pending}>Add note</Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  );
}
