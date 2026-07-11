import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Real-Postgres RLS tests for the Widget Platform module (db/migrations/
 * 0009, 0010), mirroring the pattern in
 * src/test/integration/tenant-isolation.test.ts and
 * knowledge-tenant-isolation.test.ts: skip cleanly (not fail) when live
 * credentials aren't configured, never mock the database for
 * security-critical behavior.
 *
 * Also covers modules/widget/public-config-service.ts directly against the
 * real database — this is the module's single most security-critical path
 * (an internet-facing, unauthenticated endpoint), so it gets the same
 * real-DB treatment as RLS, not a mocked unit test.
 */

const hasLiveDatabase = Boolean(
  process.env.DATABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_APP_URL,
);

describe.skipIf(!hasLiveDatabase)("widget platform cross-tenant isolation (live Supabase project required)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mod: any;
  let orgA: { id: string };
  let orgB: { id: string };
  let userA: { id: string };
  let userB: { id: string };
  let widgetA: { id: string };
  let widgetB: { id: string };
  let keyA: { id: string; publicKey: string };
  let keyB: { id: string; publicKey: string };

  beforeAll(async () => {
    const [dbClient, schema, supabaseAdmin, drizzleOrm, publicConfigService] = await Promise.all([
      import("@/db/client"),
      import("@/db/schema"),
      import("@/lib/supabase/admin"),
      import("drizzle-orm"),
      import("@/modules/widget/public-config-service"),
    ]);
    mod = {
      db: dbClient.db,
      withRlsContext: dbClient.withRlsContext,
      schema,
      admin: supabaseAdmin.createSupabaseAdminClient(),
      eq: drizzleOrm.eq,
      resolvePublicWidgetConfig: publicConfigService.resolvePublicWidgetConfig,
    };

    const stamp = Date.now();
    const { data: userAData } = await mod.admin.auth.admin.createUser({
      email: `widget-test-a-${stamp}@example.com`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    const { data: userBData } = await mod.admin.auth.admin.createUser({
      email: `widget-test-b-${stamp}@example.com`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    userA = { id: userAData.user.id };
    userB = { id: userBData.user.id };

    const [rowA] = await mod.db
      .insert(mod.schema.organizations)
      .values({ name: "Widget Test A", slug: `widget-test-a-${stamp}` })
      .returning();
    const [rowB] = await mod.db
      .insert(mod.schema.organizations)
      .values({ name: "Widget Test B", slug: `widget-test-b-${stamp}` })
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
    const [wB] = await mod.db
      .insert(mod.schema.widgets)
      .values({ organizationId: orgB.id, name: "Widget B", status: "active", createdBy: userB.id })
      .returning();
    widgetA = { id: wA.id };
    widgetB = { id: wB.id };

    await mod.db.insert(mod.schema.widgetThemes).values([
      { organizationId: orgA.id, widgetId: widgetA.id },
      { organizationId: orgB.id, widgetId: widgetB.id },
    ]);
    await mod.db.insert(mod.schema.widgetSettings).values([
      { organizationId: orgA.id, widgetId: widgetA.id, welcomeMessage: "Hi from A" },
      { organizationId: orgB.id, widgetId: widgetB.id, welcomeMessage: "Hi from B" },
    ]);

    const [kA] = await mod.db
      .insert(mod.schema.widgetKeys)
      .values({
        organizationId: orgA.id,
        widgetId: widgetA.id,
        publicKey: `wgt_pub_test_a_${stamp}`,
      })
      .returning();
    const [kB] = await mod.db
      .insert(mod.schema.widgetKeys)
      .values({
        organizationId: orgB.id,
        widgetId: widgetB.id,
        publicKey: `wgt_pub_test_b_${stamp}`,
      })
      .returning();
    keyA = { id: kA.id, publicKey: kA.publicKey };
    keyB = { id: kB.id, publicKey: kB.publicKey };
  });

  afterAll(async () => {
    if (!mod) return;
    // widget_keys/widget_domains/widget_themes/widget_settings all cascade
    // on widgets.id, which cascades on organizations.id — deleting the two
    // test orgs below is sufficient.
    await mod.db.delete(mod.schema.memberships).where(mod.eq(mod.schema.memberships.organizationId, orgA.id));
    await mod.db.delete(mod.schema.memberships).where(mod.eq(mod.schema.memberships.organizationId, orgB.id));
    await mod.db.delete(mod.schema.organizations).where(mod.eq(mod.schema.organizations.id, orgA.id));
    await mod.db.delete(mod.schema.organizations).where(mod.eq(mod.schema.organizations.id, orgB.id));
    await mod.admin.auth.admin.deleteUser(userA.id);
    await mod.admin.auth.admin.deleteUser(userB.id);
  });

  describe("widgets", () => {
    it("RLS-scoped select only returns the caller's own org's widgets", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.widgets),
      );
      expect(rows.every((r: { organizationId: string }) => r.organizationId === orgA.id)).toBe(true);
      expect(rows.some((r: { id: string }) => r.id === widgetA.id)).toBe(true);
    });

    it("a user cannot update another organization's widget via RLS", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .update(mod.schema.widgets)
          .set({ name: "Hijacked" })
          .where(mod.eq(mod.schema.widgets.id, widgetB.id))
          .returning(),
      );
      expect(rows).toEqual([]);

      const [stillB] = await mod.db.select().from(mod.schema.widgets).where(mod.eq(mod.schema.widgets.id, widgetB.id));
      expect(stillB.name).toBe("Widget B");
    });

    it("no DELETE policy — deletion via RLS context does not remove the row", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.delete(mod.schema.widgets).where(mod.eq(mod.schema.widgets.id, widgetA.id)).returning(),
      );
      expect(rows).toEqual([]);

      const [stillThere] = await mod.db
        .select()
        .from(mod.schema.widgets)
        .where(mod.eq(mod.schema.widgets.id, widgetA.id));
      expect(stillThere).toBeDefined();
    });

    it("soft delete is an UPDATE — a user can set status to 'archived' on their own widget via RLS", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .update(mod.schema.widgets)
          .set({ status: "archived" })
          .where(mod.eq(mod.schema.widgets.id, widgetA.id))
          .returning(),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe("archived");

      await mod.db.update(mod.schema.widgets).set({ status: "active" }).where(mod.eq(mod.schema.widgets.id, widgetA.id));
    });
  });

  describe("widget_keys", () => {
    it("RLS-scoped select only returns the caller's own org's keys", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.widgetKeys),
      );
      expect(rows.every((r: { organizationId: string }) => r.organizationId === orgA.id)).toBe(true);
    });

    it("RLS insert is rejected when organization_id belongs to another org (WITH CHECK)", async () => {
      await expect(
        mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
          tx.insert(mod.schema.widgetKeys).values({
            organizationId: orgB.id,
            widgetId: widgetB.id,
            publicKey: `wgt_pub_should_reject_${Date.now()}`,
          }),
        ),
      ).rejects.toThrow();
    });

    it("exactly one active key per widget is enforced at the database level", async () => {
      await expect(
        mod.db.insert(mod.schema.widgetKeys).values({
          organizationId: orgA.id,
          widgetId: widgetA.id,
          publicKey: `wgt_pub_second_active_${Date.now()}`,
        }),
      ).rejects.toThrow();
    });
  });

  describe("widget_domains", () => {
    it("full CRUD via RLS, scoped to the caller's own org", async () => {
      const inserted = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .insert(mod.schema.widgetDomains)
          .values({ organizationId: orgA.id, widgetId: widgetA.id, domain: "example.com" })
          .returning(),
      );
      expect(inserted).toHaveLength(1);

      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.widgetDomains).where(mod.eq(mod.schema.widgetDomains.widgetId, widgetA.id)),
      );
      expect(rows).toHaveLength(1);

      const deleted = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .delete(mod.schema.widgetDomains)
          .where(mod.eq(mod.schema.widgetDomains.id, inserted[0].id))
          .returning(),
      );
      expect(deleted).toHaveLength(1);
    });

    it("a user cannot see another organization's domain list", async () => {
      const [row] = await mod.db
        .insert(mod.schema.widgetDomains)
        .values({ organizationId: orgB.id, widgetId: widgetB.id, domain: "orgb-only.com" })
        .returning();

      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.widgetDomains).where(mod.eq(mod.schema.widgetDomains.id, row.id)),
      );
      expect(rows).toEqual([]);

      await mod.db.delete(mod.schema.widgetDomains).where(mod.eq(mod.schema.widgetDomains.id, row.id));
    });

    it("the same domain cannot be added twice to the same widget", async () => {
      const [first] = await mod.db
        .insert(mod.schema.widgetDomains)
        .values({ organizationId: orgA.id, widgetId: widgetA.id, domain: "dupe-test.com" })
        .returning();

      await expect(
        mod.db.insert(mod.schema.widgetDomains).values({
          organizationId: orgA.id,
          widgetId: widgetA.id,
          domain: "dupe-test.com",
        }),
      ).rejects.toThrow();

      await mod.db.delete(mod.schema.widgetDomains).where(mod.eq(mod.schema.widgetDomains.id, first.id));
    });
  });

  describe("widget_themes / widget_settings", () => {
    it("a user cannot read another organization's theme or settings", async () => {
      const themeRows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.widgetThemes).where(mod.eq(mod.schema.widgetThemes.widgetId, widgetB.id)),
      );
      expect(themeRows).toEqual([]);

      const settingsRows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .select()
          .from(mod.schema.widgetSettings)
          .where(mod.eq(mod.schema.widgetSettings.widgetId, widgetB.id)),
      );
      expect(settingsRows).toEqual([]);
    });

    it("a user can update their own widget's theme via RLS", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .update(mod.schema.widgetThemes)
          .set({ primaryColor: "#123456" })
          .where(mod.eq(mod.schema.widgetThemes.widgetId, widgetA.id))
          .returning(),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].primaryColor).toBe("#123456");
    });
  });

  describe("public config resolution (modules/widget/public-config-service.ts)", () => {
    it("returns public-safe config for a valid active key with no domain restriction", async () => {
      const config = await mod.resolvePublicWidgetConfig(keyA.publicKey, null);
      expect(config.name).toBe("Widget A");
      expect(config.behaviour.welcomeMessage).toBe("Hi from A");
      expect(config).not.toHaveProperty("organizationId");
      expect(config).not.toHaveProperty("id");
      expect(config).not.toHaveProperty("widgetId");
    });

    it("rejects an unknown key with a generic error", async () => {
      await expect(mod.resolvePublicWidgetConfig("wgt_pub_does_not_exist", null)).rejects.toThrow(
        "Invalid widget configuration request",
      );
    });

    it("rejects a revoked key with the same generic error", async () => {
      await mod.db
        .update(mod.schema.widgetKeys)
        .set({ status: "revoked", revokedAt: new Date() })
        .where(mod.eq(mod.schema.widgetKeys.id, keyB.id));

      await expect(mod.resolvePublicWidgetConfig(keyB.publicKey, null)).rejects.toThrow(
        "Invalid widget configuration request",
      );

      await mod.db
        .update(mod.schema.widgetKeys)
        .set({ status: "active", revokedAt: null })
        .where(mod.eq(mod.schema.widgetKeys.id, keyB.id));
    });

    it("rejects a valid key whose widget is not active (disabled/draft)", async () => {
      await mod.db.update(mod.schema.widgets).set({ status: "disabled" }).where(mod.eq(mod.schema.widgets.id, widgetB.id));

      await expect(mod.resolvePublicWidgetConfig(keyB.publicKey, null)).rejects.toThrow(
        "Invalid widget configuration request",
      );

      await mod.db.update(mod.schema.widgets).set({ status: "active" }).where(mod.eq(mod.schema.widgets.id, widgetB.id));
    });

    it("enforces the domain allowlist once at least one domain is configured", async () => {
      const [domain] = await mod.db
        .insert(mod.schema.widgetDomains)
        .values({ organizationId: orgA.id, widgetId: widgetA.id, domain: "allowed.example.com" })
        .returning();

      await expect(mod.resolvePublicWidgetConfig(keyA.publicKey, "not-allowed.example.com")).rejects.toThrow(
        "Invalid widget configuration request",
      );
      await expect(mod.resolvePublicWidgetConfig(keyA.publicKey, null)).rejects.toThrow(
        "Invalid widget configuration request",
      );

      const config = await mod.resolvePublicWidgetConfig(keyA.publicKey, "allowed.example.com");
      expect(config.name).toBe("Widget A");

      await mod.db.delete(mod.schema.widgetDomains).where(mod.eq(mod.schema.widgetDomains.id, domain.id));
    });

    it("rejects a matching but disabled domain entry", async () => {
      const [domain] = await mod.db
        .insert(mod.schema.widgetDomains)
        .values({
          organizationId: orgA.id,
          widgetId: widgetA.id,
          domain: "disabled.example.com",
          isEnabled: false,
        })
        .returning();

      await expect(mod.resolvePublicWidgetConfig(keyA.publicKey, "disabled.example.com")).rejects.toThrow(
        "Invalid widget configuration request",
      );

      await mod.db.delete(mod.schema.widgetDomains).where(mod.eq(mod.schema.widgetDomains.id, domain.id));
    });

    it("org A's key never resolves org B's data even by coincidence of shared origin", async () => {
      const config = await mod.resolvePublicWidgetConfig(keyA.publicKey, null);
      expect(config.name).not.toBe("Widget B");
      expect(config.behaviour.welcomeMessage).not.toBe("Hi from B");
    });
  });
});
