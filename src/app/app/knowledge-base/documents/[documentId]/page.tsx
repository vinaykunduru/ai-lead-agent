import { notFound } from "next/navigation";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/shared/components/page-header";
import { BackLink } from "@/shared/components/back-link";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getDocument,
  getDocumentSearchStats,
  listDocumentChunks,
} from "@/modules/knowledge/documents-service";
import { listCollections } from "@/modules/knowledge/collections-service";
import { listResourceAuditLogs } from "@/modules/audit/service";
import { DocumentTypeBadge } from "../../status-badges";
import { DocumentActions } from "./document-actions";
import { ProcessingStatusCard } from "./processing-status-card";

async function resolveUploaderEmail(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

export default async function DocumentDetailsPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  if (!z.string().uuid().safeParse(documentId).success) {
    notFound();
  }

  const session = await requireCompanySession();
  const document = await getDocument(documentId);
  if (!document) {
    notFound();
  }

  const [searchStats, chunks, collections, auditLogs, uploaderEmail] = await Promise.all([
    getDocumentSearchStats(documentId),
    listDocumentChunks(documentId),
    listCollections(),
    listResourceAuditLogs("knowledge_document", documentId),
    resolveUploaderEmail(document.uploadedBy),
  ]);

  const collectionName = collections.find((c) => c.id === document.collectionId)?.name ?? "—";

  const permissions = {
    canUpdate: can(session, "knowledge.update"),
    canDelete: can(session, "knowledge.delete"),
    canReprocess: can(session, "knowledge.reprocess"),
  };
  const canSearch = can(session, "knowledge.search");

  return (
    <div>
      <div className="border-b px-6 pt-5">
        <BackLink href="/app/knowledge-base" label="Knowledge Base" />
      </div>
      <PageHeader
        title={document.title}
        actions={<DocumentActions documentId={document.id} status={document.status} {...permissions} />}
      />

      <div className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Type" value={<DocumentTypeBadge type={document.type} />} />
            <Row label="Collection" value={collectionName} />
            <Row label="Language" value={document.language ?? "Unknown"} />
            {document.fileSizeBytes ? (
              <Row label="File size" value={`${(document.fileSizeBytes / 1024).toFixed(1)} KB`} />
            ) : null}
            {document.sourceUrl ? (
              <Row
                label="Source URL"
                value={
                  <a href={document.sourceUrl} target="_blank" rel="noreferrer" className="truncate hover:underline">
                    {document.sourceUrl}
                  </a>
                }
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Upload info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Uploaded by" value={uploaderEmail ?? "Unknown"} />
            <Row label="Uploaded at" value={document.createdAt.toLocaleString()} />
            <Row label="Updated at" value={document.updatedAt.toLocaleString()} />
          </CardContent>
        </Card>

        <ProcessingStatusCard
          documentId={document.id}
          chunkCount={chunks.length}
          canSearch={canSearch}
          initial={{
            status: document.status,
            embeddingStatus: document.embeddingStatus,
            chunkCount: document.chunkCount,
            tokenCount: document.tokenCount,
            errorMessage: document.errorMessage,
          }}
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Search statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Appearances in search results" value={searchStats.appearances} />
            <Row
              label="Last matched"
              value={searchStats.lastSearchedAt ? searchStats.lastSearchedAt.toLocaleString() : "Never"}
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Audit history</CardTitle>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {auditLogs.map((log) => (
                  <li key={log.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <span>{log.action}</span>
                    <span className="text-muted-foreground">{log.createdAt.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] truncate text-right font-medium">{value}</span>
    </div>
  );
}
