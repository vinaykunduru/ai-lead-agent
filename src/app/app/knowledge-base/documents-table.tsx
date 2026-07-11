"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/shared/components/empty-state";
import type { KnowledgeCollection } from "@/db/schema";
import type { PublicKnowledgeDocument } from "@/modules/knowledge/documents-service";
import { DocumentStatusBadge, DocumentTypeBadge } from "./status-badges";
import { UploadDialog } from "./upload-dialog";

type Props = {
  documents: PublicKnowledgeDocument[];
  collections: KnowledgeCollection[];
  activeCollectionId?: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canReprocess: boolean;
};

export function DocumentsTable({
  documents,
  collections,
  activeCollectionId,
  canCreate,
  canUpdate,
  canDelete,
  canReprocess,
}: Props) {
  const router = useRouter();
  const collectionNameById = new Map(collections.map((c) => [c.id, c.name]));

  async function reprocess(documentId: string) {
    const res = await fetch(`/api/knowledge/documents/${documentId}/reprocess`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not start reprocessing");
      return;
    }
    toast.success("Reprocessing started");
    router.refresh();
  }

  async function archive(documentId: string) {
    const res = await fetch(`/api/knowledge/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not archive document");
      return;
    }
    toast.success("Document archived");
    router.refresh();
  }

  async function softDelete(documentId: string) {
    const res = await fetch(`/api/knowledge/documents/${documentId}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? "Could not delete document");
      return;
    }
    toast.success("Document deleted");
    router.refresh();
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          {documents.length} document{documents.length === 1 ? "" : "s"}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.refresh()}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          {canCreate ? (
            <UploadDialog collections={collections} defaultCollectionId={activeCollectionId} />
          ) : null}
        </div>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          title="No documents yet"
          description="Upload a file, paste text, or import a web page to start training your AI agent."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Collection</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Chunks</TableHead>
              <TableHead>Tokens</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell className="max-w-xs truncate">
                  <Link href={`/app/knowledge-base/documents/${doc.id}`} className="font-medium hover:underline">
                    {doc.title}
                  </Link>
                </TableCell>
                <TableCell>
                  <DocumentTypeBadge type={doc.type} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {collectionNameById.get(doc.collectionId) ?? "—"}
                </TableCell>
                <TableCell>
                  <DocumentStatusBadge status={doc.status} />
                  {doc.status === "failed" && doc.errorMessage ? (
                    <p className="mt-1 max-w-48 truncate text-xs text-destructive" title={doc.errorMessage}>
                      {doc.errorMessage}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">{doc.chunkCount}</TableCell>
                <TableCell className="text-muted-foreground">{doc.tokenCount}</TableCell>
                <TableCell className="text-muted-foreground">
                  {doc.createdAt.toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => router.push(`/app/knowledge-base/documents/${doc.id}`)}
                      >
                        View details
                      </DropdownMenuItem>
                      {canReprocess && (doc.status === "ready" || doc.status === "failed") ? (
                        <DropdownMenuItem onClick={() => reprocess(doc.id)}>Reprocess</DropdownMenuItem>
                      ) : null}
                      {canUpdate && doc.status !== "archived" ? (
                        <DropdownMenuItem onClick={() => archive(doc.id)}>Archive</DropdownMenuItem>
                      ) : null}
                      {canDelete ? (
                        <DropdownMenuItem variant="destructive" onClick={() => softDelete(doc.id)}>
                          Delete
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
