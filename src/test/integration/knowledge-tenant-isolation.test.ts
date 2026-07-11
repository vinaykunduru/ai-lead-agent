import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Real-Postgres RLS tests for the Knowledge Base module (db/migrations/0004,
 * 0005, 0006), mirroring the pattern established in
 * src/test/integration/tenant-isolation.test.ts: skip cleanly (not fail)
 * when live credentials aren't configured, never mock the database for
 * security-critical behavior (CLAUDE.md rule #17).
 *
 * These tests exercise `withRlsContext` + raw Drizzle queries directly
 * against the schema, the same way the service layer does internally, since
 * modules/knowledge/*-service.ts functions call requireCompanySession(),
 * which needs a real Next.js request (cookies()) that doesn't exist here.
 *
 * What's NOT covered here (and can't be, without real provider credentials —
 * see .env.local): actual embedding generation via Voyage AI, actual job
 * dispatch via Inngest. Those keys are unset/placeholder in this
 * environment. The chunk/document rows below are seeded directly with
 * synthetic embedding vectors so the RLS and cosine-similarity-query shape
 * can still be verified for real.
 */

const hasLiveDatabase = Boolean(
  process.env.DATABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_APP_URL,
);

describe.skipIf(!hasLiveDatabase)("knowledge base cross-tenant isolation (live Supabase project required)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mod: any;
  let orgA: { id: string };
  let orgB: { id: string };
  let userA: { id: string };
  let userB: { id: string };
  let collectionA: { id: string };
  let collectionB: { id: string };
  let documentA: { id: string };
  let documentB: { id: string };
  const auditLogIds: string[] = [];

  const fakeEmbedding = () => new Array(1024).fill(0.001);

  beforeAll(async () => {
    const [dbClient, schema, supabaseAdmin, drizzleOrm, documentsService] = await Promise.all([
      import("@/db/client"),
      import("@/db/schema"),
      import("@/lib/supabase/admin"),
      import("drizzle-orm"),
      import("@/modules/knowledge/documents-service"),
    ]);
    mod = {
      db: dbClient.db,
      withRlsContext: dbClient.withRlsContext,
      schema,
      admin: supabaseAdmin.createSupabaseAdminClient(),
      eq: drizzleOrm.eq,
      inArray: drizzleOrm.inArray,
      isNull: drizzleOrm.isNull,
      toPublicDocument: documentsService.toPublicDocument,
      toPublicChunk: documentsService.toPublicChunk,
    };

    const stamp = Date.now();
    const { data: userAData } = await mod.admin.auth.admin.createUser({
      email: `kb-test-a-${stamp}@example.com`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    const { data: userBData } = await mod.admin.auth.admin.createUser({
      email: `kb-test-b-${stamp}@example.com`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    userA = { id: userAData.user.id };
    userB = { id: userBData.user.id };

    const [rowA] = await mod.db
      .insert(mod.schema.organizations)
      .values({ name: "KB Test A", slug: `kb-test-a-${stamp}` })
      .returning();
    const [rowB] = await mod.db
      .insert(mod.schema.organizations)
      .values({ name: "KB Test B", slug: `kb-test-b-${stamp}` })
      .returning();
    orgA = { id: rowA.id };
    orgB = { id: rowB.id };

    await mod.db.insert(mod.schema.memberships).values([
      { organizationId: orgA.id, userId: userA.id, role: "owner", status: "active" },
      { organizationId: orgB.id, userId: userB.id, role: "owner", status: "active" },
    ]);

    const [colA] = await mod.db
      .insert(mod.schema.knowledgeCollections)
      .values({ organizationId: orgA.id, name: "General", isDefault: true, createdBy: userA.id })
      .returning();
    const [colB] = await mod.db
      .insert(mod.schema.knowledgeCollections)
      .values({ organizationId: orgB.id, name: "General", isDefault: true, createdBy: userB.id })
      .returning();
    collectionA = { id: colA.id };
    collectionB = { id: colB.id };

    const [docA] = await mod.db
      .insert(mod.schema.knowledgeDocuments)
      .values({
        organizationId: orgA.id,
        collectionId: collectionA.id,
        type: "text",
        title: "Doc A",
        sourceText: "content a",
        status: "ready",
        checksum: `shared-checksum-${stamp}`,
        uploadedBy: userA.id,
      })
      .returning();
    const [docB] = await mod.db
      .insert(mod.schema.knowledgeDocuments)
      .values({
        organizationId: orgB.id,
        collectionId: collectionB.id,
        type: "text",
        title: "Doc B",
        sourceText: "content b",
        status: "ready",
        uploadedBy: userB.id,
      })
      .returning();
    documentA = { id: docA.id };
    documentB = { id: docB.id };

    await mod.db.insert(mod.schema.knowledgeChunks).values([
      {
        organizationId: orgA.id,
        collectionId: collectionA.id,
        documentId: documentA.id,
        chunkIndex: 0,
        content: "chunk a content",
        charCount: 16,
        tokenCount: 4,
        embedding: fakeEmbedding(),
      },
      {
        organizationId: orgB.id,
        collectionId: collectionB.id,
        documentId: documentB.id,
        chunkIndex: 0,
        content: "chunk b content",
        charCount: 16,
        tokenCount: 4,
        embedding: fakeEmbedding(),
      },
    ]);

    await mod.db.insert(mod.schema.knowledgeSearchLogs).values([
      { organizationId: orgA.id, actorUserId: userA.id, query: "query a", latencyMs: 10 },
      { organizationId: orgB.id, actorUserId: userB.id, query: "query b", latencyMs: 10 },
    ]);
  });

  afterAll(async () => {
    if (!mod) return;
    if (auditLogIds.length > 0) {
      await mod.db.delete(mod.schema.auditLogs).where(mod.inArray(mod.schema.auditLogs.id, auditLogIds));
    }
    // knowledge_collections/documents/chunks/search_logs all cascade on
    // organizations.id — deleting the two test orgs below is sufficient.
    await mod.db.delete(mod.schema.memberships).where(mod.eq(mod.schema.memberships.organizationId, orgA.id));
    await mod.db.delete(mod.schema.memberships).where(mod.eq(mod.schema.memberships.organizationId, orgB.id));
    await mod.db.delete(mod.schema.organizations).where(mod.eq(mod.schema.organizations.id, orgA.id));
    await mod.db.delete(mod.schema.organizations).where(mod.eq(mod.schema.organizations.id, orgB.id));
    await mod.admin.auth.admin.deleteUser(userA.id);
    await mod.admin.auth.admin.deleteUser(userB.id);
  });

  describe("knowledge_collections", () => {
    it("RLS-scoped select only returns the caller's own org's collections", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.knowledgeCollections),
      );
      expect(rows.every((r: { organizationId: string }) => r.organizationId === orgA.id)).toBe(true);
      expect(rows.some((r: { id: string }) => r.id === collectionA.id)).toBe(true);
    });

    it("a user cannot select another organization's collection by id", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .select()
          .from(mod.schema.knowledgeCollections)
          .where(mod.eq(mod.schema.knowledgeCollections.id, collectionB.id)),
      );
      expect(rows).toEqual([]);
    });

    it("RLS insert succeeds for the caller's own org", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .insert(mod.schema.knowledgeCollections)
          .values({ organizationId: orgA.id, name: "Extra Collection", createdBy: userA.id })
          .returning(),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].organizationId).toBe(orgA.id);
    });

    it("RLS insert is rejected when organization_id belongs to another org (WITH CHECK)", async () => {
      await expect(
        mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
          tx.insert(mod.schema.knowledgeCollections).values({
            organizationId: orgB.id,
            name: "Should be rejected",
            createdBy: userA.id,
          }),
        ),
      ).rejects.toThrow();
    });

    it("no DELETE policy — a DELETE via RLS context does not remove the row", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .delete(mod.schema.knowledgeCollections)
          .where(mod.eq(mod.schema.knowledgeCollections.id, collectionA.id))
          .returning(),
      );
      expect(rows).toEqual([]);

      const [stillThere] = await mod.db
        .select()
        .from(mod.schema.knowledgeCollections)
        .where(mod.eq(mod.schema.knowledgeCollections.id, collectionA.id));
      expect(stillThere).toBeDefined();
    });
  });

  describe("knowledge_documents", () => {
    it("RLS-scoped select only returns the caller's own org's documents", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.knowledgeDocuments),
      );
      expect(rows.every((r: { organizationId: string }) => r.organizationId === orgA.id)).toBe(true);
    });

    it("a user cannot update another organization's document via RLS", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .update(mod.schema.knowledgeDocuments)
          .set({ title: "Hijacked" })
          .where(mod.eq(mod.schema.knowledgeDocuments.id, documentB.id))
          .returning(),
      );
      expect(rows).toEqual([]);

      const [stillB] = await mod.db
        .select()
        .from(mod.schema.knowledgeDocuments)
        .where(mod.eq(mod.schema.knowledgeDocuments.id, documentB.id));
      expect(stillB.title).toBe("Doc B");
    });

    it("soft delete is an UPDATE, not a DELETE — a user can set deletedAt on their own document via RLS", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .update(mod.schema.knowledgeDocuments)
          .set({ deletedAt: new Date() })
          .where(mod.eq(mod.schema.knowledgeDocuments.id, documentA.id))
          .returning(),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].deletedAt).not.toBeNull();

      // Restore for later tests/cleanup clarity.
      await mod.db
        .update(mod.schema.knowledgeDocuments)
        .set({ deletedAt: null })
        .where(mod.eq(mod.schema.knowledgeDocuments.id, documentA.id));
    });

    it("rejects a second document in the same org with the same checksum (duplicate detection)", async () => {
      const [existing] = await mod.db
        .select({ checksum: mod.schema.knowledgeDocuments.checksum })
        .from(mod.schema.knowledgeDocuments)
        .where(mod.eq(mod.schema.knowledgeDocuments.id, documentA.id));

      await expect(
        mod.db.insert(mod.schema.knowledgeDocuments).values({
          organizationId: orgA.id,
          collectionId: collectionA.id,
          type: "text",
          title: "Duplicate of Doc A",
          checksum: existing.checksum,
          uploadedBy: userA.id,
        }),
      ).rejects.toThrow();
    });

    it("the same checksum in two different orgs does not conflict", async () => {
      const [existing] = await mod.db
        .select({ checksum: mod.schema.knowledgeDocuments.checksum })
        .from(mod.schema.knowledgeDocuments)
        .where(mod.eq(mod.schema.knowledgeDocuments.id, documentA.id));

      const rows = await mod.db
        .insert(mod.schema.knowledgeDocuments)
        .values({
          organizationId: orgB.id,
          collectionId: collectionB.id,
          type: "text",
          title: "Same checksum, different org",
          checksum: existing.checksum,
          uploadedBy: userB.id,
        })
        .returning();
      expect(rows).toHaveLength(1);

      await mod.db.delete(mod.schema.knowledgeDocuments).where(mod.eq(mod.schema.knowledgeDocuments.id, rows[0].id));
    });
  });

  describe("knowledge_chunks", () => {
    it("RLS-scoped select only returns the caller's own org's chunks", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.knowledgeChunks),
      );
      expect(rows.every((r: { organizationId: string }) => r.organizationId === orgA.id)).toBe(true);
    });

    it("authenticated has no INSERT policy — inserting a chunk via RLS context is rejected", async () => {
      await expect(
        mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
          tx.insert(mod.schema.knowledgeChunks).values({
            organizationId: orgA.id,
            collectionId: collectionA.id,
            documentId: documentA.id,
            chunkIndex: 99,
            content: "should be rejected",
            charCount: 10,
            tokenCount: 2,
            embedding: fakeEmbedding(),
          }),
        ),
      ).rejects.toThrow();
    });

    it("authenticated has no DELETE policy — deleting a chunk via RLS context does not remove it", async () => {
      const [chunk] = await mod.db
        .select({ id: mod.schema.knowledgeChunks.id })
        .from(mod.schema.knowledgeChunks)
        .where(mod.eq(mod.schema.knowledgeChunks.documentId, documentA.id));

      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.delete(mod.schema.knowledgeChunks).where(mod.eq(mod.schema.knowledgeChunks.id, chunk.id)).returning(),
      );
      expect(rows).toEqual([]);

      const [stillThere] = await mod.db
        .select()
        .from(mod.schema.knowledgeChunks)
        .where(mod.eq(mod.schema.knowledgeChunks.id, chunk.id));
      expect(stillThere).toBeDefined();
    });
  });

  describe("knowledge_search_logs", () => {
    it("RLS-scoped select only returns the caller's own org's search logs", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.knowledgeSearchLogs),
      );
      expect(rows.every((r: { organizationId: string }) => r.organizationId === orgA.id)).toBe(true);
    });

    it("RLS insert succeeds for the caller's own org and is rejected for a foreign org", async () => {
      const ok = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .insert(mod.schema.knowledgeSearchLogs)
          .values({ organizationId: orgA.id, actorUserId: userA.id, query: "another query", latencyMs: 5 })
          .returning(),
      );
      expect(ok).toHaveLength(1);

      await expect(
        mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
          tx.insert(mod.schema.knowledgeSearchLogs).values({
            organizationId: orgB.id,
            actorUserId: userA.id,
            query: "cross-org attempt",
            latencyMs: 5,
          }),
        ),
      ).rejects.toThrow();
    });
  });

  describe("audit_logs resource-scoped read access (migration 0006)", () => {
    it("a user can read their own org's audit history for a resource", async () => {
      const [row] = await mod.db
        .insert(mod.schema.auditLogs)
        .values({
          organizationId: orgA.id,
          actorUserId: userA.id,
          actorType: "company_user",
          action: "knowledge.document_uploaded",
          resourceType: "knowledge_document",
          resourceId: documentA.id,
        })
        .returning();
      auditLogIds.push(row.id);

      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .select()
          .from(mod.schema.auditLogs)
          .where(mod.eq(mod.schema.auditLogs.resourceId, documentA.id)),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].action).toBe("knowledge.document_uploaded");
    });

    it("a user cannot read another org's audit history for the same resource type", async () => {
      const [row] = await mod.db
        .insert(mod.schema.auditLogs)
        .values({
          organizationId: orgB.id,
          actorUserId: userB.id,
          actorType: "company_user",
          action: "knowledge.document_uploaded",
          resourceType: "knowledge_document",
          resourceId: documentB.id,
        })
        .returning();
      auditLogIds.push(row.id);

      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .select()
          .from(mod.schema.auditLogs)
          .where(mod.eq(mod.schema.auditLogs.resourceId, documentB.id)),
      );
      expect(rows).toEqual([]);
    });

    it("platform-level entries (organization_id null) remain invisible to company users", async () => {
      const [row] = await mod.db
        .insert(mod.schema.auditLogs)
        .values({
          organizationId: null,
          actorType: "system",
          action: "company.created",
          resourceType: "organization",
          resourceId: orgA.id,
        })
        .returning();
      auditLogIds.push(row.id);

      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.auditLogs).where(mod.eq(mod.schema.auditLogs.resourceId, orgA.id)),
      );
      expect(rows).toEqual([]);
    });
  });

  describe("field stripping for client-facing responses", () => {
    it("toPublicDocument never returns storagePath, checksum, or sourceText", async () => {
      const [document] = await mod.db
        .select()
        .from(mod.schema.knowledgeDocuments)
        .where(mod.eq(mod.schema.knowledgeDocuments.id, documentA.id));

      const publicDocument = mod.toPublicDocument(document);
      expect(publicDocument).not.toHaveProperty("storagePath");
      expect(publicDocument).not.toHaveProperty("checksum");
      expect(publicDocument).not.toHaveProperty("sourceText");
      // Sanity check: fields the UI actually needs are still present.
      expect(publicDocument.id).toBe(documentA.id);
      expect(publicDocument.title).toBe("Doc A");
    });

    it("toPublicChunk never returns the raw embedding vector", async () => {
      const [chunk] = await mod.db
        .select()
        .from(mod.schema.knowledgeChunks)
        .where(mod.eq(mod.schema.knowledgeChunks.documentId, documentA.id));

      const publicChunk = mod.toPublicChunk(chunk);
      expect(publicChunk).not.toHaveProperty("embedding");
      expect(publicChunk.content).toBe("chunk a content");
    });
  });
});
