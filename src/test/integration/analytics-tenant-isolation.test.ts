import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Real-Postgres RLS tests for the Analytics module (db/migrations/0015,
 * 0016), mirroring the pattern established in every prior
 * src/test/integration/*.test.ts file: skip cleanly (not fail) when live
 * credentials aren't configured, never mock the database for
 * security-critical behavior.
 *
 * Like modules/ai-behaviour and modules/leads' integration tests, these
 * exercise `withRlsContext` + raw Drizzle queries directly against the
 * schema, since modules/analytics/*-service.ts functions all call
 * requireCompanySession(), which needs a real Next.js request (cookies())
 * that doesn't exist here. Where a service's core aggregate SQL shape is
 * non-trivial (the knowledge "no-match" NOT EXISTS query, the per-org
 * conversation_usage sums), the same query shape is exercised directly
 * against seeded fixture data to verify it's actually correct, not just
 * that RLS scopes it.
 */

const hasLiveDatabase = Boolean(
  process.env.DATABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_APP_URL,
);

describe.skipIf(!hasLiveDatabase)("analytics cross-tenant isolation (live Supabase project required)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mod: any;
  let orgA: { id: string };
  let orgB: { id: string };
  let userA: { id: string };
  let userB: { id: string };
  let widgetA: { id: string };
  let conversationA: { id: string };

  beforeAll(async () => {
    const [dbClient, schema, supabaseAdmin, drizzleOrm] = await Promise.all([
      import("@/db/client"),
      import("@/db/schema"),
      import("@/lib/supabase/admin"),
      import("drizzle-orm"),
    ]);
    mod = {
      db: dbClient.db,
      withRlsContext: dbClient.withRlsContext,
      schema,
      admin: supabaseAdmin.createSupabaseAdminClient(),
      eq: drizzleOrm.eq,
      and: drizzleOrm.and,
      sql: drizzleOrm.sql,
      notExists: drizzleOrm.notExists,
    };

    const stamp = Date.now();
    const { data: userAData } = await mod.admin.auth.admin.createUser({
      email: `analytics-test-a-${stamp}@example.com`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    const { data: userBData } = await mod.admin.auth.admin.createUser({
      email: `analytics-test-b-${stamp}@example.com`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    userA = { id: userAData.user.id };
    userB = { id: userBData.user.id };

    const [rowA] = await mod.db
      .insert(mod.schema.organizations)
      .values({ name: "Analytics Test A", slug: `analytics-test-a-${stamp}` })
      .returning();
    const [rowB] = await mod.db
      .insert(mod.schema.organizations)
      .values({ name: "Analytics Test B", slug: `analytics-test-b-${stamp}` })
      .returning();
    orgA = { id: rowA.id };
    orgB = { id: rowB.id };

    await mod.db.insert(mod.schema.memberships).values([
      { organizationId: orgA.id, userId: userA.id, role: "owner", status: "active" },
      { organizationId: orgB.id, userId: userB.id, role: "owner", status: "active" },
    ]);

    const [wA] = await mod.db
      .insert(mod.schema.widgets)
      .values({ organizationId: orgA.id, name: "Widget A", status: "active", createdBy: userA.id })
      .returning();
    widgetA = { id: wA.id };

    const [sessionA] = await mod.db
      .insert(mod.schema.conversationSessions)
      .values({ organizationId: orgA.id, widgetId: widgetA.id, visitorId: crypto.randomUUID() })
      .returning();
    const [convA] = await mod.db
      .insert(mod.schema.conversations)
      .values({ organizationId: orgA.id, widgetId: widgetA.id, sessionId: sessionA.id })
      .returning();
    conversationA = { id: convA.id };
  });

  afterAll(async () => {
    if (!mod) return;
    await mod.db.delete(mod.schema.memberships).where(mod.eq(mod.schema.memberships.organizationId, orgA.id));
    await mod.db.delete(mod.schema.memberships).where(mod.eq(mod.schema.memberships.organizationId, orgB.id));
    await mod.db.delete(mod.schema.organizations).where(mod.eq(mod.schema.organizations.id, orgA.id));
    await mod.db.delete(mod.schema.organizations).where(mod.eq(mod.schema.organizations.id, orgB.id));
    await mod.admin.auth.admin.deleteUser(userA.id);
    await mod.admin.auth.admin.deleteUser(userB.id);
  });

  describe("analytics_alert_rules RLS (full CRUD, company-owned config)", () => {
    it("RLS-scoped select only returns the caller's own org's rules", async () => {
      await mod.db.insert(mod.schema.analyticsAlertRules).values([
        { organizationId: orgA.id, name: "A rule", metric: "failure_rate", operator: "gt", threshold: "10" },
        { organizationId: orgB.id, name: "B rule", metric: "bounce_rate", operator: "gt", threshold: "50" },
      ]);

      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.analyticsAlertRules),
      );
      expect(rows.every((r: { organizationId: string }) => r.organizationId === orgA.id)).toBe(true);
      expect(rows.some((r: { name: string }) => r.name === "A rule")).toBe(true);
    });

    it("RLS insert is rejected for a foreign org (WITH CHECK)", async () => {
      await expect(
        mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
          tx.insert(mod.schema.analyticsAlertRules).values({
            organizationId: orgB.id,
            name: "Hijack",
            metric: "failure_rate",
            operator: "gt",
            threshold: "1",
          }),
        ),
      ).rejects.toThrow();
    });

    it("a company can delete its own alert rule but not another org's", async () => {
      const [ownRule] = await mod.db
        .select({ id: mod.schema.analyticsAlertRules.id })
        .from(mod.schema.analyticsAlertRules)
        .where(mod.eq(mod.schema.analyticsAlertRules.organizationId, orgA.id));
      const [foreignRule] = await mod.db
        .select({ id: mod.schema.analyticsAlertRules.id })
        .from(mod.schema.analyticsAlertRules)
        .where(mod.eq(mod.schema.analyticsAlertRules.organizationId, orgB.id));

      const rejectedDelete = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.delete(mod.schema.analyticsAlertRules).where(mod.eq(mod.schema.analyticsAlertRules.id, foreignRule.id)).returning(),
      );
      expect(rejectedDelete).toEqual([]);

      const allowedDelete = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.delete(mod.schema.analyticsAlertRules).where(mod.eq(mod.schema.analyticsAlertRules.id, ownRule.id)).returning(),
      );
      expect(allowedDelete).toHaveLength(1);
    });
  });

  describe("dashboard_preferences RLS (singleton config, no delete)", () => {
    it("RLS-scoped select only returns the caller's own org's preferences", async () => {
      await mod.db.insert(mod.schema.dashboardPreferences).values([
        { organizationId: orgA.id, cards: [{ key: "totalConversations", visible: true, sortOrder: 0 }] },
        { organizationId: orgB.id, cards: [{ key: "leadsGenerated", visible: true, sortOrder: 0 }] },
      ]);

      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.dashboardPreferences),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].organizationId).toBe(orgA.id);
    });

    it("a user cannot update another organization's dashboard preferences via RLS", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .update(mod.schema.dashboardPreferences)
          .set({ cards: [] })
          .where(mod.eq(mod.schema.dashboardPreferences.organizationId, orgB.id))
          .returning(),
      );
      expect(rows).toEqual([]);
    });

    it("no DELETE policy — a DELETE via RLS context does not remove the row", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .delete(mod.schema.dashboardPreferences)
          .where(mod.eq(mod.schema.dashboardPreferences.organizationId, orgA.id))
          .returning(),
      );
      expect(rows).toEqual([]);
      const [stillThere] = await mod.db
        .select()
        .from(mod.schema.dashboardPreferences)
        .where(mod.eq(mod.schema.dashboardPreferences.organizationId, orgA.id));
      expect(stillThere).toBeDefined();
    });
  });

  describe("AI performance aggregate correctness (same query shape as ai-performance-service.ts)", () => {
    it("sums cost/tokens/latency scoped to the caller's own org only", async () => {
      const [msgA] = await mod.db
        .insert(mod.schema.conversationMessages)
        .values({
          organizationId: orgA.id,
          conversationId: conversationA.id,
          role: "assistant",
          content: "hi",
          status: "complete",
          provider: "claude",
          model: "claude-test",
        })
        .returning();

      await mod.db.insert(mod.schema.conversationUsage).values({
        organizationId: orgA.id,
        conversationId: conversationA.id,
        messageId: msgA.id,
        provider: "claude",
        model: "claude-test",
        promptTokens: 100,
        completionTokens: 50,
        latencyMs: 400,
        estimatedCostUsd: "0.005",
      });

      const [agg] = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .select({
            avgLatency: mod.sql`avg(${mod.schema.conversationUsage.latencyMs})`,
            totalCost: mod.sql`sum(${mod.schema.conversationUsage.estimatedCostUsd})`,
          })
          .from(mod.schema.conversationUsage)
          .where(mod.eq(mod.schema.conversationUsage.organizationId, orgA.id)),
      );
      expect(Number(agg.avgLatency)).toBe(400);
      expect(Number(agg.totalCost)).toBeCloseTo(0.005, 5);

      const rowsForB = await mod.withRlsContext(userB.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.conversationUsage),
      );
      expect(rowsForB).toEqual([]);
    });
  });

  describe("knowledge no-match detection (same NOT EXISTS shape as knowledge-analytics-service.ts)", () => {
    it("a finished assistant reply with zero citations counts as no-match; one with a citation does not", async () => {
      const [collection] = await mod.db
        .insert(mod.schema.knowledgeCollections)
        .values({ organizationId: orgA.id, name: "Docs", isDefault: true })
        .returning();
      const [document] = await mod.db
        .insert(mod.schema.knowledgeDocuments)
        .values({ organizationId: orgA.id, collectionId: collection.id, type: "text", title: "Doc", status: "ready" })
        .returning();
      const [chunk] = await mod.db
        .insert(mod.schema.knowledgeChunks)
        .values({
          organizationId: orgA.id,
          collectionId: collection.id,
          documentId: document.id,
          chunkIndex: 0,
          content: "content",
          charCount: 7,
          tokenCount: 2,
          embedding: new Array(1024).fill(0),
        })
        .returning();

      const [replyWithCitation] = await mod.db
        .insert(mod.schema.conversationMessages)
        .values({
          organizationId: orgA.id,
          conversationId: conversationA.id,
          role: "assistant",
          content: "cited answer",
          status: "complete",
          provider: "claude",
          model: "claude-test",
        })
        .returning();
      await mod.db.insert(mod.schema.conversationCitations).values({
        organizationId: orgA.id,
        conversationId: conversationA.id,
        messageId: replyWithCitation.id,
        chunkId: chunk.id,
        documentId: document.id,
        similarity: 0.9,
        confidence: "high",
      });

      const [replyNoMatch] = await mod.db
        .insert(mod.schema.conversationMessages)
        .values({
          organizationId: orgA.id,
          conversationId: conversationA.id,
          role: "assistant",
          content: "I don't have enough information",
          status: "complete",
          provider: "claude",
          model: "claude-test",
        })
        .returning();

      const noMatchRows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .select({ id: mod.schema.conversationMessages.id })
          .from(mod.schema.conversationMessages)
          .where(
            mod.and(
              mod.eq(mod.schema.conversationMessages.organizationId, orgA.id),
              mod.eq(mod.schema.conversationMessages.role, "assistant"),
              mod.eq(mod.schema.conversationMessages.status, "complete"),
              mod.notExists(
                tx
                  .select({ id: mod.schema.conversationCitations.id })
                  .from(mod.schema.conversationCitations)
                  .where(mod.eq(mod.schema.conversationCitations.messageId, mod.schema.conversationMessages.id)),
              ),
            ),
          ),
      );

      // Scoped to `.toContain`/`.not.toContain` rather than an exact array
      // match — the preceding "AI performance aggregate correctness" test
      // in this same describe block also inserts an assistant reply with
      // no citations into the same conversation, so the no-match set
      // legitimately has more than just this one row.
      const noMatchIds = noMatchRows.map((r: { id: string }) => r.id);
      expect(noMatchIds).toContain(replyNoMatch.id);
      expect(noMatchIds).not.toContain(replyWithCitation.id);
    });
  });
});
