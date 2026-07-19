"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, AlertTriangle, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmbeddingStatusBadge } from "../../status-badges";

const POLL_INTERVAL_MS = 4000;

type Status = {
  status: string;
  embeddingStatus: string;
  chunkCount: number;
  tokenCount: number;
  errorMessage: string | null;
};

export function ProcessingStatusCard({
  documentId,
  chunkCount,
  initial,
  canSearch,
}: {
  documentId: string;
  chunkCount: number;
  initial: Status;
  canSearch: boolean;
}) {
  const [state, setState] = useState(initial);
  const isProcessing = state.status === "pending" || state.status === "processing";

  useEffect(() => {
    if (!isProcessing) return;

    const timer = setInterval(async () => {
      const res = await fetch(`/api/knowledge/documents/${documentId}`);
      if (!res.ok) return;
      const { document } = await res.json();
      setState({
        status: document.status,
        embeddingStatus: document.embeddingStatus,
        chunkCount: document.chunkCount,
        tokenCount: document.tokenCount,
        errorMessage: document.errorMessage,
      });
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
    // Polling is scoped entirely to this effect's own lifetime — it starts
    // when the doc is still processing and stops itself (via the isProcessing
    // guard above triggering unmount-and-remount with no interval) once a
    // poll response reports ready/failed. No need to re-run on every state tick.
  }, [documentId, isProcessing]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">Processing status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div aria-live="polite" className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
          {isProcessing ? (
            <>
              <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
              <div>
                <p className="font-medium">Reading and indexing your document</p>
                <p className="mt-0.5 text-caption text-muted-foreground">
                  We&rsquo;re extracting the text, splitting it into chunks, and generating embeddings so
                  your AI can search it. This usually takes under a minute — this page updates
                  automatically.
                </p>
              </div>
            </>
          ) : state.status === "ready" ? (
            <>
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Your AI can now use this document</p>
                <p className="mt-0.5 text-caption text-muted-foreground">
                  Indexed into {state.chunkCount} chunk{state.chunkCount === 1 ? "" : "s"} ({state.tokenCount}{" "}
                  tokens). It&rsquo;s already part of what your AI can answer from.
                </p>
                {canSearch ? (
                  <Button variant="outline" size="sm" className="mt-3" render={
                    <Link href="/app/knowledge-base/search">
                      <Search className="size-3.5" aria-hidden="true" />
                      Test what your AI finds here
                    </Link>
                  } />
                ) : null}
              </div>
            </>
          ) : state.status === "failed" ? (
            <>
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
              <div>
                <p className="font-medium">This document couldn&rsquo;t be processed</p>
                <p className="mt-0.5 text-caption text-muted-foreground">
                  {state.errorMessage ?? "Something went wrong while reading this document."} Use
                  &ldquo;Reprocess&rdquo; above to try again, or check the file and re-upload it.
                </p>
              </div>
            </>
          ) : (
            <div>
              <p className="font-medium capitalize">{state.status}</p>
              <p className="mt-0.5 text-caption text-muted-foreground">
                This document was archived and is no longer used by your AI.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Embedding status</span>
          <EmbeddingStatusBadge status={state.embeddingStatus} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Chunk count</span>
          <span className="font-medium">{state.chunkCount}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Token count</span>
          <span className="font-medium">{state.tokenCount}</span>
        </div>
        <div className="pt-1">
          <Link
            href={`/app/knowledge-base/documents/${documentId}/chunks`}
            className="text-sm text-primary hover:underline"
          >
            View {chunkCount} chunk{chunkCount === 1 ? "" : "s"} →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
