import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { type RlsDb, withRlsContext } from "@/db/client";
import {
  knowledgeChunks,
  knowledgeCollections,
  knowledgeDocuments,
  knowledgeSearchLogs,
  type KnowledgeChunk,
  type KnowledgeDocument,
} from "@/db/schema";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import { enqueueJob } from "@/providers/jobs";
import { storageProvider } from "@/providers/storage";
import { computeChecksum } from "./utils";
import {
  ALLOWED_UPLOAD_EXTENSIONS,
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  type CreateTextDocumentInput,
  type CreateWebsiteDocumentInput,
  type UpdateDocumentInput,
} from "./validation";

export const DOCUMENT_PROCESS_EVENT = "knowledge/document.process";

/**
 * storagePath/checksum are internal (spec: "Never expose storage paths"),
 * and sourceText can be up to 200,000 chars of raw content that no UI
 * screen actually needs to render (Document Details shows metadata/status/
 * counts; chunk content is what Chunk Viewer shows). Every function that
 * returns a document to a caller — including API route JSON responses and
 * props passed to "use client" components, both of which ship to the
 * browser — strips these first.
 */
export type PublicKnowledgeDocument = Omit<KnowledgeDocument, "storagePath" | "checksum" | "sourceText">;

export function toPublicDocument(document: KnowledgeDocument): PublicKnowledgeDocument {
  const { storagePath: _storagePath, checksum: _checksum, sourceText: _sourceText, ...rest } = document;
  return rest;
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}

async function assertCollectionBelongsToOrg(
  tx: RlsDb,
  collectionId: string,
  organizationId: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: knowledgeCollections.id })
    .from(knowledgeCollections)
    .where(
      and(
        eq(knowledgeCollections.id, collectionId),
        eq(knowledgeCollections.organizationId, organizationId),
        isNull(knowledgeCollections.deletedAt),
      ),
    )
    .limit(1);
  if (!row) {
    throw new Error("Collection not found");
  }
}

export type DocumentListFilter = { collectionId?: string };

export async function listDocuments(filter: DocumentListFilter = {}): Promise<PublicKnowledgeDocument[]> {
  const session = await requireCompanySession();
  assertPermission(session, "knowledge.view");

  const rows = await withRlsContext(session.userId, async (tx) => {
    const conditions = [
      eq(knowledgeDocuments.organizationId, session.organizationId),
      isNull(knowledgeDocuments.deletedAt),
    ];
    if (filter.collectionId) {
      conditions.push(eq(knowledgeDocuments.collectionId, filter.collectionId));
    }
    return tx
      .select()
      .from(knowledgeDocuments)
      .where(and(...conditions))
      .orderBy(desc(knowledgeDocuments.createdAt));
  });

  return rows.map(toPublicDocument);
}

export async function getDocument(documentId: string): Promise<PublicKnowledgeDocument | null> {
  const session = await requireCompanySession();
  assertPermission(session, "knowledge.view");

  const document = await withRlsContext(session.userId, async (tx) => {
    const [row] = await tx
      .select()
      .from(knowledgeDocuments)
      .where(
        and(
          eq(knowledgeDocuments.id, documentId),
          eq(knowledgeDocuments.organizationId, session.organizationId),
        ),
      )
      .limit(1);
    return row ?? null;
  });

  return document ? toPublicDocument(document) : null;
}

/**
 * The Chunk Viewer never needs the raw 1024-dimension embedding vector
 * (spec: "Never expose embeddings") — only chunk text and metadata.
 */
export type PublicKnowledgeChunk = Omit<KnowledgeChunk, "embedding">;

export function toPublicChunk(chunk: KnowledgeChunk): PublicKnowledgeChunk {
  const { embedding: _embedding, ...rest } = chunk;
  return rest;
}

export async function listDocumentChunks(documentId: string): Promise<PublicKnowledgeChunk[]> {
  const session = await requireCompanySession();
  assertPermission(session, "knowledge.view");

  const rows = await withRlsContext(session.userId, async (tx) => {
    return tx
      .select()
      .from(knowledgeChunks)
      .where(
        and(
          eq(knowledgeChunks.documentId, documentId),
          eq(knowledgeChunks.organizationId, session.organizationId),
        ),
      )
      .orderBy(knowledgeChunks.chunkIndex);
  });

  return rows.map(toPublicChunk);
}

export async function createTextDocument(input: CreateTextDocumentInput): Promise<PublicKnowledgeDocument> {
  const session = await requireCompanySession();
  assertPermission(session, "knowledge.create");

  const document = await withRlsContext(session.userId, async (tx) => {
    await assertCollectionBelongsToOrg(tx, input.collectionId, session.organizationId);
    const [row] = await tx
      .insert(knowledgeDocuments)
      .values({
        organizationId: session.organizationId,
        collectionId: input.collectionId,
        type: "text",
        title: input.title,
        sourceText: input.content,
        uploadedBy: session.userId,
      })
      .returning();
    return row;
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "knowledge.document_uploaded",
    resourceType: "knowledge_document",
    resourceId: document.id,
    metadata: { type: "text", title: document.title },
  });

  await enqueueJob(DOCUMENT_PROCESS_EVENT, { documentId: document.id });
  return toPublicDocument(document);
}

export async function createWebsiteDocument(
  input: CreateWebsiteDocumentInput,
): Promise<PublicKnowledgeDocument> {
  const session = await requireCompanySession();
  assertPermission(session, "knowledge.create");

  const document = await withRlsContext(session.userId, async (tx) => {
    await assertCollectionBelongsToOrg(tx, input.collectionId, session.organizationId);
    const [row] = await tx
      .insert(knowledgeDocuments)
      .values({
        organizationId: session.organizationId,
        collectionId: input.collectionId,
        type: "website",
        title: input.url,
        sourceUrl: input.url,
        uploadedBy: session.userId,
      })
      .returning();
    return row;
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "knowledge.document_uploaded",
    resourceType: "knowledge_document",
    resourceId: document.id,
    metadata: { type: "website", url: input.url },
  });

  await enqueueJob(DOCUMENT_PROCESS_EVENT, { documentId: document.id });
  return toPublicDocument(document);
}

export type UploadDocumentFileParams = {
  collectionId: string;
  title: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

export async function uploadDocumentFile(params: UploadDocumentFileParams): Promise<PublicKnowledgeDocument> {
  const session = await requireCompanySession();
  assertPermission(session, "knowledge.create");

  if (params.buffer.length === 0) {
    throw new Error("File is empty");
  }
  if (params.buffer.length > MAX_UPLOAD_FILE_SIZE_BYTES) {
    throw new Error("File is too large (max 20MB)");
  }
  const type = ALLOWED_UPLOAD_MIME_TYPES[params.mimeType as keyof typeof ALLOWED_UPLOAD_MIME_TYPES];
  if (!type) {
    throw new Error("Unsupported file type");
  }
  const extension = params.fileName.toLowerCase().slice(params.fileName.lastIndexOf("."));
  if (!(ALLOWED_UPLOAD_EXTENSIONS as readonly string[]).includes(extension)) {
    throw new Error("Unsupported file extension");
  }

  const checksum = computeChecksum(params.buffer);

  // Pre-flight checks (collection ownership, duplicate detection) happen
  // before anything touches storage — the database's unique index on
  // (organization_id, checksum) is still the authoritative guard against a
  // concurrent-upload race; this is just a fast, friendly pre-check.
  await withRlsContext(session.userId, async (tx) => {
    await assertCollectionBelongsToOrg(tx, params.collectionId, session.organizationId);
    const [existing] = await tx
      .select({ id: knowledgeDocuments.id })
      .from(knowledgeDocuments)
      .where(
        and(
          eq(knowledgeDocuments.organizationId, session.organizationId),
          eq(knowledgeDocuments.checksum, checksum),
          isNull(knowledgeDocuments.deletedAt),
        ),
      )
      .limit(1);
    if (existing) {
      throw new Error("This file has already been uploaded");
    }
  });

  // Upload before creating the row (not after) so there's never a document
  // row pointing at a file that doesn't exist. The inverse risk — a file in
  // storage with no document row, if the insert below fails after a
  // successful upload — is an orphaned object, not a data-integrity or
  // security issue; acceptable for Phase 1 rather than building two-phase
  // commit for it.
  const documentId = randomUUID();
  const storagePath = `${session.organizationId}/${documentId}/${params.fileName}`;
  await storageProvider.upload(storagePath, params.buffer, params.mimeType);

  let document: KnowledgeDocument;
  try {
    document = await withRlsContext(session.userId, async (tx) => {
      const [row] = await tx
        .insert(knowledgeDocuments)
        .values({
          id: documentId,
          organizationId: session.organizationId,
          collectionId: params.collectionId,
          type,
          title: params.title,
          checksum,
          storagePath,
          fileSizeBytes: params.buffer.length,
          uploadedBy: session.userId,
        })
        .returning();
      return row;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("This file has already been uploaded");
    }
    throw error;
  }

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "knowledge.document_uploaded",
    resourceType: "knowledge_document",
    resourceId: document.id,
    metadata: { type, title: document.title, fileSizeBytes: document.fileSizeBytes },
  });

  await enqueueJob(DOCUMENT_PROCESS_EVENT, { documentId: document.id });
  return toPublicDocument(document);
}

export async function updateDocument(input: UpdateDocumentInput): Promise<PublicKnowledgeDocument> {
  const session = await requireCompanySession();
  assertPermission(session, "knowledge.update");

  const document = await withRlsContext(session.userId, async (tx) => {
    if (input.collectionId) {
      await assertCollectionBelongsToOrg(tx, input.collectionId, session.organizationId);
    }
    const patch: Partial<typeof knowledgeDocuments.$inferInsert> = { updatedAt: new Date() };
    if (input.title !== undefined) patch.title = input.title;
    if (input.collectionId !== undefined) patch.collectionId = input.collectionId;

    const [row] = await tx
      .update(knowledgeDocuments)
      .set(patch)
      .where(eq(knowledgeDocuments.id, input.documentId))
      .returning();
    return row;
  });

  if (!document) {
    throw new Error("Document not found");
  }

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "knowledge.document_updated",
    resourceType: "knowledge_document",
    resourceId: document.id,
  });

  return toPublicDocument(document);
}

export async function archiveDocument(documentId: string): Promise<PublicKnowledgeDocument> {
  const session = await requireCompanySession();
  assertPermission(session, "knowledge.update");

  const document = await withRlsContext(session.userId, async (tx) => {
    const [row] = await tx
      .update(knowledgeDocuments)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(knowledgeDocuments.id, documentId))
      .returning();
    return row;
  });

  if (!document) {
    throw new Error("Document not found");
  }

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "knowledge.document_archived",
    resourceType: "knowledge_document",
    resourceId: document.id,
  });

  return toPublicDocument(document);
}

/** Soft delete only — never a hard DELETE from user-facing code. */
export async function softDeleteDocument(documentId: string): Promise<void> {
  const session = await requireCompanySession();
  assertPermission(session, "knowledge.delete");

  const document = await withRlsContext(session.userId, async (tx) => {
    const [row] = await tx
      .update(knowledgeDocuments)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(knowledgeDocuments.id, documentId))
      .returning();
    return row;
  });

  if (!document) {
    throw new Error("Document not found");
  }

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "knowledge.document_deleted",
    resourceType: "knowledge_document",
    resourceId: document.id,
  });
}

export type DocumentSearchStats = {
  appearances: number;
  lastSearchedAt: Date | null;
};

/**
 * "Search Statistics" for a document's detail page — derived from
 * knowledge_search_logs.top_results rather than a separate counter table,
 * since search volume is expected to be low enough in Phase 1 that scanning
 * recent logs is simpler than maintaining a denormalized count.
 */
export async function getDocumentSearchStats(documentId: string): Promise<DocumentSearchStats> {
  const session = await requireCompanySession();
  assertPermission(session, "knowledge.view");

  return withRlsContext(session.userId, async (tx) => {
    const rows = await tx
      .select({ topResults: knowledgeSearchLogs.topResults, createdAt: knowledgeSearchLogs.createdAt })
      .from(knowledgeSearchLogs)
      .where(eq(knowledgeSearchLogs.organizationId, session.organizationId))
      .orderBy(desc(knowledgeSearchLogs.createdAt))
      .limit(200);

    let appearances = 0;
    let lastSearchedAt: Date | null = null;
    for (const row of rows) {
      const results = Array.isArray(row.topResults) ? (row.topResults as { documentId?: string }[]) : [];
      if (results.some((r) => r.documentId === documentId)) {
        appearances += 1;
        if (!lastSearchedAt) lastSearchedAt = row.createdAt;
      }
    }
    return { appearances, lastSearchedAt };
  });
}

/**
 * Resets a document to pending and re-enqueues the same processing job
 * (modules/knowledge/processing-service.ts) that handled it the first
 * time — it already deletes old chunks and inserts new ones inside a
 * single transaction, satisfying "delete old chunks, regenerate, replace
 * atomically" without a separate code path.
 */
export async function requestReprocessDocument(documentId: string): Promise<void> {
  const session = await requireCompanySession();
  assertPermission(session, "knowledge.reprocess");

  const document = await withRlsContext(session.userId, async (tx) => {
    const [row] = await tx
      .select({ id: knowledgeDocuments.id })
      .from(knowledgeDocuments)
      .where(
        and(
          eq(knowledgeDocuments.id, documentId),
          eq(knowledgeDocuments.organizationId, session.organizationId),
          isNull(knowledgeDocuments.deletedAt),
        ),
      )
      .limit(1);
    return row ?? null;
  });

  if (!document) {
    throw new Error("Document not found");
  }

  await withRlsContext(session.userId, (tx) =>
    tx
      .update(knowledgeDocuments)
      .set({ status: "pending", embeddingStatus: "pending", errorMessage: null, updatedAt: new Date() })
      .where(eq(knowledgeDocuments.id, documentId)),
  );

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "knowledge.document_reprocessed",
    resourceType: "knowledge_document",
    resourceId: documentId,
  });

  await enqueueJob(DOCUMENT_PROCESS_EVENT, { documentId });
}
