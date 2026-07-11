import "server-only";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { type RlsDb, withRlsContext } from "@/db/client";
import { knowledgeCollections, type KnowledgeCollection } from "@/db/schema";
import { requireCompanySession, type CompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import type { CreateCollectionInput, RenameCollectionInput } from "./validation";

const DEFAULT_COLLECTION_NAME = "General";

/**
 * Every organization gets a "General" collection the first time its
 * knowledge base is touched — see the module spec. Created lazily rather
 * than at company-creation time to avoid coupling modules/organizations to
 * modules/knowledge (CLAUDE.md's modular-monolith rule: modules stay
 * decoupled unless there's a real reason to reach into each other).
 */
async function ensureDefaultCollection(tx: RlsDb, session: CompanySession): Promise<void> {
  const [existing] = await tx
    .select({ id: knowledgeCollections.id })
    .from(knowledgeCollections)
    .where(eq(knowledgeCollections.organizationId, session.organizationId))
    .limit(1);
  if (existing) return;

  await tx.insert(knowledgeCollections).values({
    organizationId: session.organizationId,
    name: DEFAULT_COLLECTION_NAME,
    isDefault: true,
    createdBy: session.userId,
  });
}

export async function listCollections(): Promise<KnowledgeCollection[]> {
  const session = await requireCompanySession();
  assertPermission(session, "knowledge.view");

  return withRlsContext(session.userId, async (tx) => {
    await ensureDefaultCollection(tx, session);
    return tx
      .select()
      .from(knowledgeCollections)
      .where(
        and(
          eq(knowledgeCollections.organizationId, session.organizationId),
          isNull(knowledgeCollections.deletedAt),
        ),
      )
      .orderBy(desc(knowledgeCollections.isDefault), asc(knowledgeCollections.name));
  });
}

export async function createCollection(input: CreateCollectionInput): Promise<KnowledgeCollection> {
  const session = await requireCompanySession();
  assertPermission(session, "knowledge.create");

  const collection = await withRlsContext(session.userId, async (tx) => {
    await ensureDefaultCollection(tx, session);
    const [row] = await tx
      .insert(knowledgeCollections)
      .values({
        organizationId: session.organizationId,
        name: input.name,
        createdBy: session.userId,
      })
      .returning();
    return row;
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "knowledge.collection_created",
    resourceType: "knowledge_collection",
    resourceId: collection.id,
    metadata: { name: collection.name },
  });

  return collection;
}

export async function renameCollection(input: RenameCollectionInput): Promise<KnowledgeCollection> {
  const session = await requireCompanySession();
  assertPermission(session, "knowledge.update");

  const collection = await withRlsContext(session.userId, async (tx) => {
    const [row] = await tx
      .update(knowledgeCollections)
      .set({ name: input.name, updatedAt: new Date() })
      .where(eq(knowledgeCollections.id, input.collectionId))
      .returning();
    return row;
  });

  if (!collection) {
    throw new Error("Collection not found");
  }

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "knowledge.collection_updated",
    resourceType: "knowledge_collection",
    resourceId: collection.id,
    metadata: { name: collection.name },
  });

  return collection;
}

export async function archiveCollection(collectionId: string): Promise<KnowledgeCollection> {
  const session = await requireCompanySession();
  assertPermission(session, "knowledge.update");

  const collection = await withRlsContext(session.userId, async (tx) => {
    const [row] = await tx
      .update(knowledgeCollections)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(knowledgeCollections.id, collectionId))
      .returning();
    return row;
  });

  if (!collection) {
    throw new Error("Collection not found");
  }

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "knowledge.collection_archived",
    resourceType: "knowledge_collection",
    resourceId: collection.id,
  });

  return collection;
}

export async function restoreCollection(collectionId: string): Promise<KnowledgeCollection> {
  const session = await requireCompanySession();
  assertPermission(session, "knowledge.update");

  const collection = await withRlsContext(session.userId, async (tx) => {
    const [row] = await tx
      .update(knowledgeCollections)
      .set({ status: "active", updatedAt: new Date() })
      .where(eq(knowledgeCollections.id, collectionId))
      .returning();
    return row;
  });

  if (!collection) {
    throw new Error("Collection not found");
  }

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "knowledge.collection_updated",
    resourceType: "knowledge_collection",
    resourceId: collection.id,
    metadata: { restored: true },
  });

  return collection;
}

/** Soft delete only — CLAUDE.md / spec: "No permanent delete by default". */
export async function softDeleteCollection(collectionId: string): Promise<void> {
  const session = await requireCompanySession();
  assertPermission(session, "knowledge.delete");

  const collection = await withRlsContext(session.userId, async (tx) => {
    const [row] = await tx
      .update(knowledgeCollections)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(knowledgeCollections.id, collectionId))
      .returning();
    return row;
  });

  if (!collection) {
    throw new Error("Collection not found");
  }

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "knowledge.collection_archived",
    resourceType: "knowledge_collection",
    resourceId: collection.id,
    metadata: { softDeleted: true },
  });
}
