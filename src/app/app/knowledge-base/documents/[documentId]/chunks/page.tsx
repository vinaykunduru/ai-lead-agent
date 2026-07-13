import { notFound } from "next/navigation";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";
import { BackLink } from "@/shared/components/back-link";
import { getDocument, listDocumentChunks } from "@/modules/knowledge/documents-service";
import { EmbeddingStatusBadge } from "../../../status-badges";
import { CopyChunkButton } from "./copy-chunk-button";

export default async function ChunkViewerPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  if (!z.string().uuid().safeParse(documentId).success) {
    notFound();
  }

  const document = await getDocument(documentId);
  if (!document) {
    notFound();
  }

  const chunks = await listDocumentChunks(documentId);

  return (
    <div>
      <div className="border-b px-6 pt-5">
        <BackLink href={`/app/knowledge-base/documents/${documentId}`} label={document.title} />
      </div>
      <PageHeader
        title="Chunk viewer"
        description={`${chunks.length} chunk${chunks.length === 1 ? "" : "s"} generated from this document.`}
      />

      <div className="p-6">
        {chunks.length === 0 ? (
          <EmptyState
            title="No chunks yet"
            description="Chunks appear here once the document has finished processing."
          />
        ) : (
          <div className="space-y-3">
            {chunks.map((chunk) => (
              <Card key={chunk.id}>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Chunk #{chunk.chunkIndex + 1}</span>
                      <span>{chunk.charCount} chars</span>
                      <span>{chunk.tokenCount} tokens</span>
                      {chunk.language ? <span className="uppercase">{chunk.language}</span> : null}
                      <EmbeddingStatusBadge status="ready" />
                    </div>
                    <CopyChunkButton content={chunk.content} />
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{chunk.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
