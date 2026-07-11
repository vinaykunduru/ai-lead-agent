import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Real-Postgres RLS tests for the AI Behaviour module (db/migrations/0007,
 * 0008), mirroring the pattern established in
 * src/test/integration/knowledge-tenant-isolation.test.ts: skip cleanly
 * (not fail) when live credentials aren't configured, never mock the
 * database for security-critical behavior.
 *
 * These tests exercise `withRlsContext` + raw Drizzle queries directly
 * against the schema, the same way the service layer does internally, since
 * modules/ai-behaviour/*-service.ts functions call requireCompanySession(),
 * which needs a real Next.js request (cookies()) that doesn't exist here.
 */

const hasLiveDatabase = Boolean(
  process.env.DATABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_APP_URL,
);

describe.skipIf(!hasLiveDatabase)("ai behaviour cross-tenant isolation (live Supabase project required)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mod: any;
  let orgA: { id: string };
  let orgB: { id: string };
  let userA: { id: string };
  let userB: { id: string };
  const auditLogIds: string[] = [];

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
      inArray: drizzleOrm.inArray,
    };

    const stamp = Date.now();
    const { data: userAData } = await mod.admin.auth.admin.createUser({
      email: `ai-behaviour-test-a-${stamp}@example.com`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    const { data: userBData } = await mod.admin.auth.admin.createUser({
      email: `ai-behaviour-test-b-${stamp}@example.com`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    userA = { id: userAData.user.id };
    userB = { id: userBData.user.id };

    const [rowA] = await mod.db
      .insert(mod.schema.organizations)
      .values({ name: "AI Behaviour Test A", slug: `ai-behaviour-test-a-${stamp}` })
      .returning();
    const [rowB] = await mod.db
      .insert(mod.schema.organizations)
      .values({ name: "AI Behaviour Test B", slug: `ai-behaviour-test-b-${stamp}` })
      .returning();
    orgA = { id: rowA.id };
    orgB = { id: rowB.id };

    await mod.db.insert(mod.schema.memberships).values([
      { organizationId: orgA.id, userId: userA.id, role: "owner", status: "active" },
      { organizationId: orgB.id, userId: userB.id, role: "owner", status: "active" },
    ]);

    await mod.db.insert(mod.schema.aiProfiles).values([
      { organizationId: orgA.id, assistantName: "Org A Assistant" },
      { organizationId: orgB.id, assistantName: "Org B Assistant" },
    ]);

    await mod.db.insert(mod.schema.aiBusinessHours).values([
      { organizationId: orgA.id },
      { organizationId: orgB.id },
    ]);

    await mod.db.insert(mod.schema.aiHandoffSettings).values([
      { organizationId: orgA.id },
      { organizationId: orgB.id },
    ]);

    await mod.db.insert(mod.schema.aiBusinessRules).values([
      { organizationId: orgA.id, text: "Org A rule", sortOrder: 0 },
      { organizationId: orgB.id, text: "Org B rule", sortOrder: 0 },
    ]);

    await mod.db.insert(mod.schema.aiLeadQuestions).values([
      { organizationId: orgA.id, fieldKey: "email", label: "Email", sortOrder: 0 },
      { organizationId: orgB.id, fieldKey: "email", label: "Email", sortOrder: 0 },
    ]);
  });

  afterAll(async () => {
    if (!mod) return;
    if (auditLogIds.length > 0) {
      await mod.db.delete(mod.schema.auditLogs).where(mod.inArray(mod.schema.auditLogs.id, auditLogIds));
    }
    // ai_profiles/ai_business_rules/ai_lead_questions/ai_business_hours/
    // ai_handoff_settings all cascade on organizations.id.
    await mod.db.delete(mod.schema.memberships).where(mod.eq(mod.schema.memberships.organizationId, orgA.id));
    await mod.db.delete(mod.schema.memberships).where(mod.eq(mod.schema.memberships.organizationId, orgB.id));
    await mod.db.delete(mod.schema.organizations).where(mod.eq(mod.schema.organizations.id, orgA.id));
    await mod.db.delete(mod.schema.organizations).where(mod.eq(mod.schema.organizations.id, orgB.id));
    await mod.admin.auth.admin.deleteUser(userA.id);
    await mod.admin.auth.admin.deleteUser(userB.id);
  });

  describe("ai_profiles", () => {
    it("RLS-scoped select only returns the caller's own org's profile", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.aiProfiles),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].assistantName).toBe("Org A Assistant");
    });

    it("RLS insert is rejected when organization_id belongs to another org (WITH CHECK)", async () => {
      await expect(
        mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
          tx.insert(mod.schema.aiProfiles).values({ organizationId: orgB.id, assistantName: "Hijack" }),
        ),
      ).rejects.toThrow();
    });

    it("a user cannot update another organization's profile via RLS", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .update(mod.schema.aiProfiles)
          .set({ assistantName: "Hijacked" })
          .where(mod.eq(mod.schema.aiProfiles.organizationId, orgB.id))
          .returning(),
      );
      expect(rows).toEqual([]);

      const [stillB] = await mod.db
        .select()
        .from(mod.schema.aiProfiles)
        .where(mod.eq(mod.schema.aiProfiles.organizationId, orgB.id));
      expect(stillB.assistantName).toBe("Org B Assistant");
    });

    it("no DELETE policy — a DELETE via RLS context does not remove the row", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .delete(mod.schema.aiProfiles)
          .where(mod.eq(mod.schema.aiProfiles.organizationId, orgA.id))
          .returning(),
      );
      expect(rows).toEqual([]);

      const [stillThere] = await mod.db
        .select()
        .from(mod.schema.aiProfiles)
        .where(mod.eq(mod.schema.aiProfiles.organizationId, orgA.id));
      expect(stillThere).toBeDefined();
    });
  });

  describe("ai_business_rules and ai_lead_questions (company-editable lists)", () => {
    it("RLS-scoped select only returns the caller's own org's rules", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.aiBusinessRules),
      );
      expect(rows.every((r: { organizationId: string }) => r.organizationId === orgA.id)).toBe(true);
    });

    it("RLS insert is rejected for a foreign org", async () => {
      await expect(
        mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
          tx.insert(mod.schema.aiBusinessRules).values({ organizationId: orgB.id, text: "Hijack" }),
        ),
      ).rejects.toThrow();
    });

    it("unlike knowledge documents, a company CAN permanently delete its own business rule via RLS", async () => {
      const [inserted] = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .insert(mod.schema.aiBusinessRules)
          .values({ organizationId: orgA.id, text: "Temporary rule", sortOrder: 1 })
          .returning(),
      );

      const deleted = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.delete(mod.schema.aiBusinessRules).where(mod.eq(mod.schema.aiBusinessRules.id, inserted.id)).returning(),
      );
      expect(deleted).toHaveLength(1);

      const [stillThere] = await mod.db
        .select()
        .from(mod.schema.aiBusinessRules)
        .where(mod.eq(mod.schema.aiBusinessRules.id, inserted.id));
      expect(stillThere).toBeUndefined();
    });

    it("a user cannot delete another organization's business rule via RLS", async () => {
      const [orgBRule] = await mod.db
        .select({ id: mod.schema.aiBusinessRules.id })
        .from(mod.schema.aiBusinessRules)
        .where(mod.eq(mod.schema.aiBusinessRules.organizationId, orgB.id));

      const deleted = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.delete(mod.schema.aiBusinessRules).where(mod.eq(mod.schema.aiBusinessRules.id, orgBRule.id)).returning(),
      );
      expect(deleted).toEqual([]);

      const [stillThere] = await mod.db
        .select()
        .from(mod.schema.aiBusinessRules)
        .where(mod.eq(mod.schema.aiBusinessRules.id, orgBRule.id));
      expect(stillThere).toBeDefined();
    });

    it("lead questions preserve sortOrder scoping per org", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.aiLeadQuestions),
      );
      expect(rows.every((r: { organizationId: string }) => r.organizationId === orgA.id)).toBe(true);
      expect(rows[0].fieldKey).toBe("email");
    });
  });

  describe("ai_business_hours and ai_handoff_settings (singleton config)", () => {
    it("RLS-scoped select only returns the caller's own org's business hours", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.aiBusinessHours),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].organizationId).toBe(orgA.id);
    });

    it("a user cannot update another organization's handoff settings via RLS", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .update(mod.schema.aiHandoffSettings)
          .set({ escalationEnabled: true })
          .where(mod.eq(mod.schema.aiHandoffSettings.organizationId, orgB.id))
          .returning(),
      );
      expect(rows).toEqual([]);
    });

    it("no DELETE policy on handoff settings — a DELETE via RLS context does not remove the row", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .delete(mod.schema.aiHandoffSettings)
          .where(mod.eq(mod.schema.aiHandoffSettings.organizationId, orgA.id))
          .returning(),
      );
      expect(rows).toEqual([]);
    });
  });

  describe("audit_logs resource-scoped read access extends to AI Behaviour actions", () => {
    it("a user can read their own org's ai_profile audit history", async () => {
      const [row] = await mod.db
        .insert(mod.schema.auditLogs)
        .values({
          organizationId: orgA.id,
          actorUserId: userA.id,
          actorType: "company_user",
          action: "ai_behaviour.profile_updated",
          resourceType: "ai_profile",
          resourceId: orgA.id,
          metadata: { fields: ["assistantName"] },
        })
        .returning();
      auditLogIds.push(row.id);

      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .select()
          .from(mod.schema.auditLogs)
          .where(mod.eq(mod.schema.auditLogs.resourceId, orgA.id)),
      );
      expect(rows.some((r: { action: string }) => r.action === "ai_behaviour.profile_updated")).toBe(true);
    });

    it("a user cannot read another org's ai_behaviour audit history for the same resourceId", async () => {
      const [row] = await mod.db
        .insert(mod.schema.auditLogs)
        .values({
          organizationId: orgB.id,
          actorUserId: userB.id,
          actorType: "company_user",
          action: "ai_behaviour.playground_tested",
          resourceType: "ai_profile",
          resourceId: orgB.id,
          metadata: { language: "en", personality: "friendly" },
        })
        .returning();
      auditLogIds.push(row.id);

      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.auditLogs).where(mod.eq(mod.schema.auditLogs.resourceId, orgB.id)),
      );
      expect(rows).toEqual([]);
    });
  });
});
