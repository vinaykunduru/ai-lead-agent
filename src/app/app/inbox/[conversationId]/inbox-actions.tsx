"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { Conversation } from "@/db/schema";

export function InboxActions({ conversation, canReply }: { conversation: Conversation; canReply: boolean }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetch(`/api/inbox/${conversation.id}/read`, { method: "POST" }).catch(() => {});
  }, [conversation.id]);

  async function takeover() {
    setPending(true);
    const res = await fetch(`/api/inbox/${conversation.id}/takeover`, { method: "POST" });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not take over");
      return;
    }
    toast.success("You've taken over this conversation");
    router.refresh();
  }

  async function resume() {
    setPending(true);
    const res = await fetch(`/api/inbox/${conversation.id}/resume`, { method: "POST" });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not resume AI");
      return;
    }
    toast.success("AI resumed");
    router.refresh();
  }

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text) return;
    setPending(true);
    const res = await fetch(`/api/inbox/${conversation.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not send reply");
      return;
    }
    setContent("");
    router.refresh();
  }

  return (
    <div className="space-y-3 border-t p-4">
      <div className="flex items-center justify-between">
        <Badge variant={conversation.owner === "human" ? "secondary" : "outline"} className="capitalize">
          {conversation.owner === "human" ? "Human owns this conversation" : "AI owns this conversation"}
        </Badge>
        {canReply ? (
          conversation.owner === "human" ? (
            <Button size="sm" variant="outline" onClick={resume} disabled={pending}>Resume AI</Button>
          ) : (
            <Button size="sm" variant="outline" onClick={takeover} disabled={pending}>Take over</Button>
          )
        ) : null}
      </div>
      {canReply ? (
        <form onSubmit={reply} className="space-y-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Reply to the visitor... (sending takes over the conversation automatically)"
            rows={3}
            maxLength={4000}
          />
          <Button type="submit" size="sm" disabled={pending || !content.trim()}>
            {pending ? "Sending..." : "Send reply"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
