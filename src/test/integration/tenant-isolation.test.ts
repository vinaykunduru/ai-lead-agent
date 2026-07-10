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
      inArray: drizzleOrm.inArray,
      sql: drizzleOrm.sql,
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

  it("(C) a user cannot update another organization's row via RLS", async () => {
    const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
      tx
        .update(mod.schema.organizations)
        .set({ name: "Hijacked" })
        .where(mod.eq(mod.schema.organizations.id, orgB.id))
        .returning(),
    );
    expect(rows).toEqual([]);

    // Confirm via the service-role path that orgB was genuinely untouched —
    // an empty `rows` result alone wouldn't distinguish "blocked" from
    // "silently no-opped".
    const [stillB] = await mod.db
      .select()
      .from(mod.schema.organizations)
      .where(mod.eq(mod.schema.organizations.id, orgB.id));
    expect(stillB.name).toBe("Tenant Test B");
  });

  it("(D) a user cannot delete another organization's row via RLS", async () => {
    const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
      tx
        .delete(mod.schema.organizations)
        .where(mod.eq(mod.schema.organizations.id, orgB.id))
        .returning(),
    );
    expect(rows).toEqual([]);

    const [stillB] = await mod.db
      .select()
      .from(mod.schema.organizations)
      .where(mod.eq(mod.schema.organizations.id, orgB.id));
    expect(stillB).toBeDefined();
  });

  it("(E) a user cannot insert a tenant-owned row while in another org's RLS context", async () => {
    // No INSERT policy exists yet for "authenticated" on memberships at all
    // (team invites are a later phase — see db/migrations/0001), so this is
    // currently blocked even more broadly than E asks: no company user can
    // insert a membership row for *any* org, which trivially covers "using
    // Company B's organization_id" too. Using userB (a real user, so the FK
    // to auth.users is satisfied) isolates the failure to RLS specifically,
    // not a foreign-key error.
    await expect(
      mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.insert(mod.schema.memberships).values({
          organizationId: orgB.id,
          userId: userB.id,
          role: "viewer",
          status: "active",
        }),
      ),
    ).rejects.toThrow();
  });

  it("(G/I) an RLS context bound to an unrecognized user id sees nothing, not an error", async () => {
    // A syntactically valid UUID that matches no real user/membership —
    // simulates "authenticated role, but no recognizable identity/context".
    const unrecognizedUserId = "00000000-0000-0000-0000-000000000000";

    const orgRows = await mod.withRlsContext(unrecognizedUserId, (tx: typeof mod.db) =>
      tx.select().from(mod.schema.organizations),
    );
    const membershipRows = await mod.withRlsContext(unrecognizedUserId, (tx: typeof mod.db) =>
      tx.select().from(mod.schema.memberships),
    );

    expect(orgRows).toEqual([]);
    expect(membershipRows).toEqual([]);
  });

  it("(H) platform-admin (service-role) access is an explicit, separate path from RLS — not a byproduct of it", async () => {
    // The service-role `db` client intentionally bypasses RLS — every
    // platform-admin service function in modules/organizations/service.ts
    // uses it, restricted to that module by code convention (CLAUDE.md
    // §3.6), not by the database. Demonstrate the boundary explicitly: it
    // sees both orgs...
    const bothOrgs = await mod.db
      .select({ id: mod.schema.organizations.id })
      .from(mod.schema.organizations)
      .where(mod.inArray(mod.schema.organizations.id, [orgA.id, orgB.id]));
    expect(bothOrgs.map((r: { id: string }) => r.id).sort()).toEqual([orgA.id, orgB.id].sort());

    // ...while the RLS-scoped path for the exact same query still only ever
    // returns the caller's own organization.
    const rlsScoped = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
      tx
        .select({ id: mod.schema.organizations.id })
        .from(mod.schema.organizations)
        .where(mod.inArray(mod.schema.organizations.id, [orgA.id, orgB.id])),
    );
    expect(rlsScoped.map((r: { id: string }) => r.id)).toEqual([orgA.id]);
  });

  it("(J) withRlsContext does not leak claims between concurrent transactions", async () => {
    const readClaimSub = (tx: typeof mod.db) =>
      tx.execute(mod.sql`select current_setting('request.jwt.claims', true)::json->>'sub' as sub`);

    const [resultA, resultB] = await Promise.all([
      mod.withRlsContext(userA.id, readClaimSub),
      mod.withRlsContext(userB.id, readClaimSub),
    ]);

    expect(resultA[0].sub).toBe(userA.id);
    expect(resultB[0].sub).toBe(userB.id);
  });

  it("a user cannot hold a second active membership in a different organization", async () => {
    // Phase 1 rule (CLAUDE.md §3): one active org per user, enforced by the
    // partial unique index in db/migrations/0002 — not just app-layer.
    // userA already has an active membership in orgA from beforeAll.
    await expect(
      mod.db.insert(mod.schema.memberships).values({
        organizationId: orgB.id,
        userId: userA.id,
        role: "viewer",
        status: "active",
      }),
    ).rejects.toThrow();
  });

  it("(§4) platform_admins access is granted and revoked immediately, independent of org membership", async () => {
    // userA is a real user with an active company membership but no
    // platform_admins row — this is the same query shape isPlatformAdmin()
    // (lib/auth/platform-admin.ts) performs.
    const before = await mod.db
      .select({ id: mod.schema.platformAdmins.id })
      .from(mod.schema.platformAdmins)
      .where(mod.eq(mod.schema.platformAdmins.userId, userA.id));
    expect(before).toEqual([]);

    await mod.db.insert(mod.schema.platformAdmins).values({ userId: userA.id });
    const granted = await mod.db
      .select({ id: mod.schema.platformAdmins.id })
      .from(mod.schema.platformAdmins)
      .where(mod.eq(mod.schema.platformAdmins.userId, userA.id));
    expect(granted).toHaveLength(1);

    await mod.db
      .delete(mod.schema.platformAdmins)
      .where(mod.eq(mod.schema.platformAdmins.userId, userA.id));
    const revoked = await mod.db
      .select({ id: mod.schema.platformAdmins.id })
      .from(mod.schema.platformAdmins)
      .where(mod.eq(mod.schema.platformAdmins.userId, userA.id));
    expect(revoked).toEqual([]);
  });
});
