import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * These tests exercise real Postgres RLS (see db/migrations/0001) against a
 * live Supabase project — they are the mandatory cross-tenant isolation
 * tests required by CLAUDE.md §7. They cannot run without real credentials,
 * so they skip cleanly (not fail) when the environment isn't configured,
 * rather than mocking the database — see CLAUDE.md rule #17 ("never use mock
 * security"). A skipped security test is an honest signal that isolation has
 * not been verified in this environment; it is not a substitute for running
 * this file for real.
 *
 * To run: set DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL,
 * NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_APP_URL in .env.local (a free
 * Supabase project or `supabase start` both work), apply the migrations in
 * db/migrations, then `pnpm test`.
 *
 * Static imports of "@/db/client" etc. are deliberately avoided at module
 * scope — those modules validate env vars on import and would throw before
 * `skipIf` ever gets a chance to skip. All DB-touching imports are dynamic
 * and live inside `beforeAll`, which vitest does not invoke for a skipped
 * suite.
 */

const hasLiveDatabase = Boolean(
  process.env.DATABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_APP_URL,
);

describe.skipIf(!hasLiveDatabase)("cross-tenant isolation (live Supabase project required)", () => {
  // `any`: these are dynamically-imported modules (see beforeAll) assembled
  // into one bag for convenience in this test-only file; a proper type here
  // would just be `typeof import(...)` intersections that add no safety
  // since every field is assigned exactly once, right below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mod: any;
  let orgA: { id: string };
  let orgB: { id: string };
  let userA: { id: string };
  let userB: { id: string };

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
    };

    const stamp = Date.now();
    const { data: userAData } = await mod.admin.auth.admin.createUser({
      email: `tenant-test-a-${stamp}@example.com`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    const { data: userBData } = await mod.admin.auth.admin.createUser({
      email: `tenant-test-b-${stamp}@example.com`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    userA = { id: userAData.user.id };
    userB = { id: userBData.user.id };

    const [rowA] = await mod.db
      .insert(mod.schema.organizations)
      .values({ name: "Tenant Test A", slug: `tenant-test-a-${stamp}` })
      .returning();
    const [rowB] = await mod.db
      .insert(mod.schema.organizations)
      .values({ name: "Tenant Test B", slug: `tenant-test-b-${stamp}` })
      .returning();
    orgA = { id: rowA.id };
    orgB = { id: rowB.id };

    await mod.db.insert(mod.schema.memberships).values([
      { organizationId: orgA.id, userId: userA.id, role: "owner", status: "active" },
      { organizationId: orgB.id, userId: userB.id, role: "owner", status: "active" },
    ]);
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

  it("an RLS-scoped query only ever returns the caller's own organization", async () => {
    const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
      tx.select().from(mod.schema.organizations),
    );
    expect(rows.map((r: { id: string }) => r.id)).toEqual([orgA.id]);
  });

  it("directly requesting another organization's id returns nothing, not an error", async () => {
    // Simulates "editing a URL" or "calling the API directly" with a foreign
    // organization id — the row must not come back, and the query must not
    // throw (which would leak that the id exists).
    const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
      tx.select().from(mod.schema.organizations).where(mod.eq(mod.schema.organizations.id, orgB.id)),
    );
    expect(rows).toEqual([]);
  });

  it("a user cannot see another organization's membership roster", async () => {
    const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
      tx.select().from(mod.schema.memberships),
    );
    expect(rows.every((r: { organizationId: string }) => r.organizationId === orgA.id)).toBe(true);
  });

  it("suspending a company blocks its own members from reading it via RLS, not just the app layer", async () => {
    await mod.db
      .update(mod.schema.organizations)
      .set({ status: "suspended" })
      .where(mod.eq(mod.schema.organizations.id, orgA.id));

    const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
      tx.select().from(mod.schema.organizations),
    );
    expect(rows).toEqual([]);

    await mod.db
      .update(mod.schema.organizations)
      .set({ status: "trial" })
      .where(mod.eq(mod.schema.organizations.id, orgA.id));
  });

  it("platform_admins is unreadable through the RLS-scoped path, even for a real authenticated user", async () => {
    const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
      tx.select().from(mod.schema.platformAdmins),
    );
    expect(rows).toEqual([]);
  });
});
