"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/shared/components/empty-state";
import type { KnowledgeCollection } from "@/db/schema";
import type { SemanticSearchResult } from "@/modules/knowledge/search-service";

const ALL_COLLECTIONS = "__all__";

export function SearchForm({ collections }: { collections: KnowledgeCollection[] }) {
  const [query, setQuery] = useState("");
  const [collectionId, setCollectionId] = useState(ALL_COLLECTIONS);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<SemanticSearchResult | null>(null);
  const collectionNameById = new Map(collections.map((c) => [c.id, c.name]));

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) {
      toast.error("Enter a search query");
      return;
    }
    setPending(true);
    const res = await fetch("/api/knowledge/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: query.trim(),
        ...(collectionId !== ALL_COLLECTIONS ? { collectionId } : {}),
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Search failed");
      return;
    }
    const data: SemanticSearchResult = await res.json();
    setResult(data);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={runSearch} className="flex flex-col gap-3 sm:flex-row" aria-busy={pending}>
        <div className="relative flex-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the knowledge base..."
            className={pending ? "pr-9" : undefined}
          />
          {pending ? (
            <Loader2
              className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          ) : null}
        </div>
        <Select value={collectionId} onValueChange={(value) => setCollectionId(value ?? ALL_COLLECTIONS)}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="All collections" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_COLLECTIONS}>All collections</SelectItem>
            {collections.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" loading={pending}>
          Search
        </Button>
      </form>

      {result ? (
        <div className={pending ? "opacity-60 transition-opacity duration-150" : "transition-opacity duration-150"} aria-live="polite">
          <p className="mb-3 text-sm text-muted-foreground">
            {result.results.length} result{result.results.length === 1 ? "" : "s"} · {result.responseTimeMs}ms
          </p>
          {result.results.length === 0 ? (
            <EmptyState
              title="No matches"
              description="Try a different phrasing, or check that documents have finished processing."
            />
          ) : (
            <div className="space-y-3">
              {result.results.map((r) => (
                <Card key={r.chunkId}>
                  <CardContent className="space-y-2 pt-6">
                    <div className="flex items-center justify-between gap-4">
                      <Link
                        href={`/app/knowledge-base/documents/${r.documentId}`}
                        className="font-medium hover:underline"
                      >
                        {r.documentTitle}
                      </Link>
                      <Badge variant="outline">{(r.similarity * 100).toFixed(1)}% match</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {collectionNameById.get(r.collectionId) ?? "—"}
                    </p>
                    <p className="text-sm">{r.chunkPreview}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
