import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Real-Supabase authentication & authorization flow tests, requested as a
 * dedicated audit of the auth module beyond the existing
 * tenant-isolation.test.ts (which already covers most organizations/
 * memberships/platform_admins RLS behavior — this file deliberately does
 * not duplicate that; see that file for org-suspension and
 * update/delete-blocking coverage).
 *
 * What this file adds:
 *  - membership *status* gating (invited/disabled), not just organization
 *    status — getCompanySession()'s query (lib/auth/session.ts) filters on
 *    status='active' explicitly, and RLS filters on it independently too;
 *    this proves both layers actually enforce it, not just one.
 *  - the real invite-link token exchange, end-to-end, against live
 *    Supabase Auth: admin.generateLink({type:'invite'}) — which, unlike
 *    inviteUserByEmail, returns the link without sending any email — then
 *    a real anon-client verifyOtp() exchanging that token for a session,
 *    proving /auth/confirm's client-side exchange logic actually works
 *    against this project's configuration, plus single-use and
 *    invalid-token rejection.
 *  - the one-active-org-per-user partial unique index's actual boundary:
 *    a disabled (not active) membership does not block a new active one.
 *  - platform admin and company membership resolve as fully independent
 *    signals for the same user (CLAUDE.md §3.7).
 *
 * Never mocks Supabase Auth or the database — skips cleanly (not fail)
 * when live credentials aren't configured, per the project's standing
 * "never fake a production integration" rule.
 */

const hasLiveDatabase = Boolean(
  process.env.DATABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_APP_URL,
);

describe.skipIf(!hasLiveDatabase)("authentication & authorization flows (live Supabase project required)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mod: any;
  let orgA: { id: string };
  let orgB: { id: string };
  let ownerUser: { id: string };
  let disabledUser: { id: string };
  let invitedUser: { id: string };

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
    };

    const stamp = Date.now();
    const makeUser = async (label: string) => {
      const { data } = await mod.admin.auth.admin.createUser({
        email: `auth-flow-test-${label}-${stamp}@example.com`,
        password: crypto.randomUUID(),
        email_confirm: true,
      });
      return { id: data.user.id, email: data.user.email as string };
    };
    ownerUser = await makeUser("owner");
    disabledUser = await makeUser("disabled");
    invitedUser = await makeUser("invited");

    const [rowA] = await mod.db
      .insert(mod.schema.organizations)
      .values({ name: "Auth Flow Test A", slug: `auth-flow-test-a-${stamp}` })
      .returning();
    const [rowB] = await mod.db
      .insert(mod.schema.organizations)
      .values({ name: "Auth Flow Test B", slug: `auth-flow-test-b-${stamp}` })
      .returning();
    orgA = { id: rowA.id };
    orgB = { id: rowB.id };

    await mod.db.insert(mod.schema.memberships).values([
      { organizationId: orgA.id, userId: ownerUser.id, role: "owner", status: "active" },
      { organizationId: orgA.id, userId: disabledUser.id, role: "viewer", status: "disabled" },
      { organizationId: orgA.id, userId: invitedUser.id, role: "viewer", status: "invited" },
    ]);
  });

  afterAll(async () => {
    if (!mod) return;
    await mod.db.delete(mod.schema.memberships).where(mod.eq(mod.schema.memberships.organizationId, orgA.id));
    await mod.db.delete(mod.schema.memberships).where(mod.eq(mod.schema.memberships.organizationId, orgB.id));
    await mod.db.delete(mod.schema.organizations).where(mod.eq(mod.schema.organizations.id, orgA.id));
    await mod.db.delete(mod.schema.organizations).where(mod.eq(mod.schema.organizations.id, orgB.id));
    await mod.admin.auth.admin.deleteUser(ownerUser.id);
    await mod.admin.auth.admin.deleteUser(disabledUser.id);
    await mod.admin.auth.admin.deleteUser(invitedUser.id);
  });

  describe("membership status gates access, not just organization status", () => {
    it("an 'active' membership resolves via the exact query getCompanySession() runs", async () => {
      const rows = await mod.withRlsContext(ownerUser.id, (tx: typeof mod.db) =>
        tx
          .select({ organizationId: mod.schema.memberships.organizationId, role: mod.schema.memberships.role })
          .from(mod.schema.memberships)
          .innerJoin(mod.schema.organizations, mod.eq(mod.schema.organizations.id, mod.schema.memberships.organizationId))
          .where(
            mod.and(mod.eq(mod.schema.memberships.userId, ownerUser.id), mod.eq(mod.schema.memberships.status, "active")),
          ),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].organizationId).toBe(orgA.id);
      expect(rows[0].role).toBe("owner");
    });

    it("a 'disabled' membership resolves to nothing — removed access, not just a role downgrade", async () => {
      const rows = await mod.withRlsContext(disabledUser.id, (tx: typeof mod.db) =>
        tx
          .select({ organizationId: mod.schema.memberships.organizationId })
          .from(mod.schema.memberships)
          .innerJoin(mod.schema.organizations, mod.eq(mod.schema.organizations.id, mod.schema.memberships.organizationId))
          .where(
            mod.and(mod.eq(mod.schema.memberships.userId, disabledUser.id), mod.eq(mod.schema.memberships.status, "active")),
          ),
      );
      expect(rows).toEqual([]);

      // Also confirm at the raw RLS-visibility level (not just the status
      // filter): active_organization_ids() itself excludes non-active rows,
      // so even an unfiltered select from a disabled user's own RLS context
      // sees no organizations.
      const orgRows = await mod.withRlsContext(disabledUser.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.organizations),
      );
      expect(orgRows).toEqual([]);
    });

    it("an 'invited' (not yet accepted) membership resolves to nothing until accepted", async () => {
      const rows = await mod.withRlsContext(invitedUser.id, (tx: typeof mod.db) =>
        tx
          .select({ organizationId: mod.schema.memberships.organizationId })
          .from(mod.schema.memberships)
          .innerJoin(mod.schema.organizations, mod.eq(mod.schema.organizations.id, mod.schema.memberships.organizationId))
          .where(
            mod.and(mod.eq(mod.schema.memberships.userId, invitedUser.id), mod.eq(mod.schema.memberships.status, "active")),
          ),
      );
      expect(rows).toEqual([]);

      const orgRows = await mod.withRlsContext(invitedUser.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.organizations),
      );
      expect(orgRows).toEqual([]);
    });
  });

  describe("one-active-org-per-user index's real boundary", () => {
    it("a disabled membership does not block the same user from becoming an active member elsewhere", async () => {
      // disabledUser has a 'disabled' row in orgA already (from beforeAll).
      // The partial unique index is `where status = 'active'`, so this
      // insert of a genuinely *active* membership in orgB must succeed.
      const [inserted] = await mod.db
        .insert(mod.schema.memberships)
        .values({ organizationId: orgB.id, userId: disabledUser.id, role: "viewer", status: "active" })
        .returning();
      expect(inserted.organizationId).toBe(orgB.id);

      // Clean up this one manually since it's outside the standard afterAll
      // deletion scope (orgB's memberships get bulk-deleted anyway via
      // organizationId, so this is technically redundant but explicit).
      await mod.db.delete(mod.schema.memberships).where(mod.eq(mod.schema.memberships.id, inserted.id));
    });
  });

  describe("real invite-link token exchange (Supabase Auth, no email sent)", () => {
    let hashedToken: string;
    let inviteEmail: string;

    it("admin.generateLink({type:'invite'}) issues a token without sending an email", async () => {
      inviteEmail = `auth-flow-invite-${Date.now()}@example.com`;
      const { data, error } = await mod.admin.auth.admin.generateLink({
        type: "invite",
        email: inviteEmail,
        options: { redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/auth/set-password` },
      });
      expect(error).toBeNull();
      expect(data.properties.hashed_token).toBeTruthy();
      expect(data.properties.action_link).toContain(encodeURIComponent("/auth/confirm"));
      hashedToken = data.properties.hashed_token;
    });

    it("the anon client can exchange that token for a real session (mirrors ConfirmClient's verifyOtp call)", async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await anon.auth.verifyOtp({ type: "invite", token_hash: hashedToken });
      expect(error).toBeNull();
      expect(data.session).toBeTruthy();
      expect(data.user?.email).toBe(inviteEmail);

      // Clean up the user generateLink created.
      if (data.user) await mod.admin.auth.admin.deleteUser(data.user.id);
    });

    it("the same token cannot be exchanged twice — Supabase enforces single-use, matching CLAUDE.md §3.11", async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await anon.auth.verifyOtp({ type: "invite", token_hash: hashedToken });
      expect(data.session).toBeNull();
      expect(error).toBeTruthy();
    });

    it("a malformed/invalid token_hash is rejected — the exact failure path /auth/confirm redirects on", async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await anon.auth.verifyOtp({ type: "invite", token_hash: "not-a-real-token" });
      expect(data.session).toBeNull();
      expect(error).toBeTruthy();
    });
  });

  describe("login mechanics (real Supabase Auth — password never entered into any UI, only used server-side, generated, never logged)", () => {
    // A disposable org+user pair local to this describe block, independent
    // of the shared fixtures above, since it needs a real password (unlike
    // every other fixture in this file, which uses email-link auth only).
    let loginOrg: { id: string };
    let loginUser: { id: string; email: string };
    let password: string;
    let sessionTokens: { access_token: string; refresh_token: string } | null = null;

    beforeAll(async () => {
      const stamp = Date.now();
      loginUser = { id: "", email: `auth-login-test-${stamp}@example.com` };
      password = crypto.randomUUID();

      const { data } = await mod.admin.auth.admin.createUser({
        email: loginUser.email,
        password,
        email_confirm: true,
      });
      loginUser.id = data.user!.id;

      const [org] = await mod.db
        .insert(mod.schema.organizations)
        .values({ name: "Login Test Org", slug: `login-test-${stamp}`, status: "active" })
        .returning();
      loginOrg = { id: org.id };
      await mod.db
        .insert(mod.schema.memberships)
        .values({ organizationId: loginOrg.id, userId: loginUser.id, role: "owner", status: "active" });
    });

    afterAll(async () => {
      await mod.db.delete(mod.schema.memberships).where(mod.eq(mod.schema.memberships.organizationId, loginOrg.id));
      await mod.db.delete(mod.schema.organizations).where(mod.eq(mod.schema.organizations.id, loginOrg.id));
      await mod.admin.auth.admin.deleteUser(loginUser.id);
    });

    it("correct credentials sign in successfully", async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await anon.auth.signInWithPassword({ email: loginUser.email, password });
      expect(error).toBeNull();
      expect(data.session).toBeTruthy();
      expect(data.user?.id).toBe(loginUser.id);
      sessionTokens = { access_token: data.session!.access_token, refresh_token: data.session!.refresh_token };
    });

    it("an incorrect password is rejected", async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await anon.auth.signInWithPassword({
        email: loginUser.email,
        password: `wrong-${crypto.randomUUID()}`,
      });
      expect(data.session).toBeNull();
      expect(error).toBeTruthy();
    });

    it("a nonexistent email fails with the same generic error as a wrong password — no user enumeration", async () => {
      const { createClient } = await import("@supabase/supabase-js");
      const anonWrongPw = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const wrongPwResult = await anonWrongPw.auth.signInWithPassword({
        email: loginUser.email,
        password: `wrong-${crypto.randomUUID()}`,
      });

      const anonNoUser = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const noUserResult = await anonNoUser.auth.signInWithPassword({
        email: `no-such-user-${Date.now()}@example.com`,
        password: "whatever-not-real",
      });

      expect(wrongPwResult.error).toBeTruthy();
      expect(noUserResult.error).toBeTruthy();
      // Both must produce the same status/message shape — the login form
      // (login-form.tsx) already collapses both to one fixed "Invalid email
      // or password." string regardless, but the underlying Auth API
      // itself must not distinguish them either, since any status/message
      // difference would be an enumeration oracle even if the current UI
      // happens to hide it today.
      expect(wrongPwResult.error?.status).toBe(noUserResult.error?.status);
      expect(wrongPwResult.error?.message).toBe(noUserResult.error?.message);
    });

    it("the session's access token resolves to the correct user (mirrors getAuthenticatedUser())", async () => {
      expect(sessionTokens).not.toBeNull();
      const { createClient } = await import("@supabase/supabase-js");
      const sessionClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      await sessionClient.auth.setSession(sessionTokens!);
      const { data } = await sessionClient.auth.getUser();
      expect(data.user?.id).toBe(loginUser.id);
    });

    it("signing out revokes the refresh token — it can no longer mint new sessions", async () => {
      expect(sessionTokens).not.toBeNull();
      const { createClient } = await import("@supabase/supabase-js");
      const sessionClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      await sessionClient.auth.setSession(sessionTokens!);
      await sessionClient.auth.signOut();

      const anonRefresh = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await anonRefresh.auth.refreshSession({ refresh_token: sessionTokens!.refresh_token });
      expect(data.session).toBeNull();
      expect(error).toBeTruthy();
    });

    it("the Auth layer and the app's membership layer are independent — disabling a membership doesn't touch the Auth account", async () => {
      // Confirms the two-layer design explicitly: Supabase Auth has no
      // concept of "membership" at all, so a disabled membership must be
      // enforced by getCompanySession()'s own query (already proven above
      // in "membership status gates access") and by RLS — never by
      // expecting Supabase Auth to somehow also reject the sign-in itself.
      await mod.db
        .update(mod.schema.memberships)
        .set({ status: "disabled" })
        .where(
          mod.and(mod.eq(mod.schema.memberships.userId, loginUser.id), mod.eq(mod.schema.memberships.organizationId, loginOrg.id)),
        );

      const { createClient } = await import("@supabase/supabase-js");
      const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await anon.auth.signInWithPassword({ email: loginUser.email, password });
      expect(error).toBeNull();
      expect(data.session).toBeTruthy();

      // But the RLS-scoped company-session query — the actual access-control
      // boundary — sees nothing for this now-disabled membership.
      const orgRows = await mod.withRlsContext(loginUser.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.organizations),
      );
      expect(orgRows).toEqual([]);

      await mod.db
        .update(mod.schema.memberships)
        .set({ status: "active" })
        .where(
          mod.and(mod.eq(mod.schema.memberships.userId, loginUser.id), mod.eq(mod.schema.memberships.organizationId, loginOrg.id)),
        );
    });
  });

  describe("platform admin and company membership are independent signals for the same user", () => {
    it("granting platform_admins does not create or require any organization membership", async () => {
      await mod.db.insert(mod.schema.platformAdmins).values({ userId: ownerUser.id });

      const adminRow = await mod.db
        .select({ id: mod.schema.platformAdmins.id })
        .from(mod.schema.platformAdmins)
        .where(mod.eq(mod.schema.platformAdmins.userId, ownerUser.id));
      expect(adminRow).toHaveLength(1);

      // ownerUser's existing company membership (orgA, from beforeAll) is
      // completely unaffected by also being a platform admin now.
      const membershipRows = await mod.withRlsContext(ownerUser.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.organizations),
      );
      expect(membershipRows.map((r: { id: string }) => r.id)).toEqual([orgA.id]);

      await mod.db.delete(mod.schema.platformAdmins).where(mod.eq(mod.schema.platformAdmins.userId, ownerUser.id));
    });
  });
});
