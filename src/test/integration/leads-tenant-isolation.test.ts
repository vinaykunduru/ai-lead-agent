import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Real-Postgres RLS + pipeline tests for the Lead Management + Human Inbox
 * module (db/migrations/0013, 0014), mirroring the pattern established in
 * every prior src/test/integration/*.test.ts file: skip cleanly (not fail)
 * when live credentials aren't configured, never mock the database for
 * security-critical behavior.
 *
 * Like modules/ai-behaviour's integration test, these exercise
 * `withRlsContext` + raw Drizzle queries directly against the schema for
 * anything that would otherwise require a real Next.js request (cookies())
 * — modules/leads/*-service.ts and modules/inbox/*-service.ts functions all
 * call requireCompanySession(), which doesn't exist here. The two
 * session-shaped helpers that don't need a real request
 * (assertLeadBelongsToOrg's agent-scoping, and handleIncomingMessage's
 * Human Takeover branch, which needs no LLM call) ARE exercised directly.
 *
 * What's NOT covered here, and honestly can't be without real provider
 * credentials (see .env.local): modules/leads/ai-summary.ts's actual LLM
 * call, and therefore the automatic-escalation branch in
 * execution-pipeline.ts, which only runs after a *successful* AI response.
 */

const hasLiveDatabase = Boolean(
  process.env.DATABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_APP_URL,
);

describe.skipIf(!hasLiveDatabase)("leads + inbox cross-tenant isolation (live Supabase project required)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mod: any;
  let orgA: { id: string };
  let orgB: { id: string };
  let userA: { id: string };
  let userB: { id: string };
  let agentUser: { id: string };
  let otherAgentUser: { id: string };
  let widgetA: { id: string };
  let keyA: { publicKey: string };
  let stageNewA: { id: string };
  let stageNewB: { id: string };
  let leadA: { id: string };
  let leadAssignedToAgent: { id: string };
  let leadB: { id: string };

  beforeAll(async () => {
    const [dbClient, schema, supabaseAdmin, drizzleOrm, executionPipeline, leadsShared] = await Promise.all([
      import("@/db/client"),
      import("@/db/schema"),
      import("@/lib/supabase/admin"),
      import("drizzle-orm"),
      import("@/modules/conversation/execution-pipeline"),
      import("@/modules/leads/shared"),
    ]);
    mod = {
      db: dbClient.db,
      withRlsContext: dbClient.withRlsContext,
      schema,
      admin: supabaseAdmin.createSupabaseAdminClient(),
      eq: drizzleOrm.eq,
      handleIncomingMessage: executionPipeline.handleIncomingMessage,
      assertLeadBelongsToOrg: leadsShared.assertLeadBelongsToOrg,
    };

    const stamp = Date.now();
    const makeUser = async (label: string) => {
      const { data } = await mod.admin.auth.admin.createUser({
        email: `leads-test-${label}-${stamp}@example.com`,
        password: crypto.randomUUID(),
        email_confirm: true,
      });
      return { id: data.user.id };
    };
    [userA, userB, agentUser, otherAgentUser] = await Promise.all([
      makeUser("a"),
      makeUser("b"),
      makeUser("agent"),
      makeUser("other-agent"),
    ]);

    const [rowA] = await mod.db
      .insert(mod.schema.organizations)
      .values({ name: "Leads Test A", slug: `leads-test-a-${stamp}` })
      .returning();
    const [rowB] = await mod.db
      .insert(mod.schema.organizations)
      .values({ name: "Leads Test B", slug: `leads-test-b-${stamp}` })
      .returning();
    orgA = { id: rowA.id };
    orgB = { id: rowB.id };

    await mod.db.insert(mod.schema.memberships).values([
      { organizationId: orgA.id, userId: userA.id, role: "owner", status: "active" },
      { organizationId: orgB.id, userId: userB.id, role: "owner", status: "active" },
      { organizationId: orgA.id, userId: agentUser.id, role: "agent", status: "active" },
      { organizationId: orgA.id, userId: otherAgentUser.id, role: "agent", status: "active" },
    ]);

    const [wA] = await mod.db
      .insert(mod.schema.widgets)
      .values({ organizationId: orgA.id, name: "Widget A", status: "active", createdBy: userA.id })
      .returning();
    widgetA = { id: wA.id };
    await mod.db.insert(mod.schema.widgetThemes).values({ organizationId: orgA.id, widgetId: widgetA.id });
    await mod.db.insert(mod.schema.widgetSettings).values({ organizationId: orgA.id, widgetId: widgetA.id });
    const [kA] = await mod.db
      .insert(mod.schema.widgetKeys)
      .values({ organizationId: orgA.id, widgetId: widgetA.id, publicKey: `wgt_pub_leads_a_${stamp}` })
      .returning();
    keyA = { publicKey: kA.publicKey };

    const [sNewA] = await mod.db
      .insert(mod.schema.leadStages)
      .values([
        { organizationId: orgA.id, name: "New", sortOrder: 0 },
        { organizationId: orgA.id, name: "Won", sortOrder: 1, isWon: true },
      ])
      .returning();
    stageNewA = { id: sNewA.id };

    const [sNewB] = await mod.db
      .insert(mod.schema.leadStages)
      .values({ organizationId: orgB.id, name: "New", sortOrder: 0 })
      .returning();
    stageNewB = { id: sNewB.id };

    const [lA] = await mod.db
      .insert(mod.schema.leads)
      .values({ organizationId: orgA.id, stageId: stageNewA.id, name: "Lead A", email: "lead-a@example.com" })
      .returning();
    leadA = { id: lA.id };

    const [lAssigned] = await mod.db
      .insert(mod.schema.leads)
      .values({
        organizationId: orgA.id,
        stageId: stageNewA.id,
        name: "Assigned Lead",
        assignedUserId: agentUser.id,
      })
      .returning();
    leadAssignedToAgent = { id: lAssigned.id };

    const [lB] = await mod.db
      .insert(mod.schema.leads)
      .values({ organizationId: orgB.id, stageId: stageNewB.id, name: "Lead B" })
      .returning();
    leadB = { id: lB.id };
  });

  afterAll(async () => {
    if (!mod) return;
    // Every lead_* / conversation_* / widget_* table cascades on
    // organizations.id — deleting the two test orgs is sufficient.
    await mod.db.delete(mod.schema.memberships).where(mod.eq(mod.schema.memberships.organizationId, orgA.id));
    await mod.db.delete(mod.schema.memberships).where(mod.eq(mod.schema.memberships.organizationId, orgB.id));
    await mod.db.delete(mod.schema.organizations).where(mod.eq(mod.schema.organizations.id, orgA.id));
    await mod.db.delete(mod.schema.organizations).where(mod.eq(mod.schema.organizations.id, orgB.id));
    await mod.admin.auth.admin.deleteUser(userA.id);
    await mod.admin.auth.admin.deleteUser(userB.id);
    await mod.admin.auth.admin.deleteUser(agentUser.id);
    await mod.admin.auth.admin.deleteUser(otherAgentUser.id);
  });

  describe("lead_stages RLS", () => {
    it("RLS-scoped select only returns the caller's own org's stages", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) => tx.select().from(mod.schema.leadStages));
      expect(rows.every((r: { organizationId: string }) => r.organizationId === orgA.id)).toBe(true);
      expect(rows.length).toBe(2);
    });

    it("RLS insert is rejected for a foreign org (WITH CHECK)", async () => {
      await expect(
        mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
          tx.insert(mod.schema.leadStages).values({ organizationId: orgB.id, name: "Hijack" }),
        ),
      ).rejects.toThrow();
    });

    it("no DELETE policy — a DELETE via RLS context does not remove the row", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.delete(mod.schema.leadStages).where(mod.eq(mod.schema.leadStages.id, stageNewA.id)).returning(),
      );
      expect(rows).toEqual([]);
      const [stillThere] = await mod.db
        .select()
        .from(mod.schema.leadStages)
        .where(mod.eq(mod.schema.leadStages.id, stageNewA.id));
      expect(stillThere).toBeDefined();
    });
  });

  describe("leads RLS", () => {
    it("RLS-scoped select only returns the caller's own org's leads", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) => tx.select().from(mod.schema.leads));
      expect(rows.every((r: { organizationId: string }) => r.organizationId === orgA.id)).toBe(true);
      expect(rows.some((r: { id: string }) => r.id === leadB.id)).toBe(false);
    });

    it("RLS insert is rejected for a foreign org", async () => {
      await expect(
        mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
          tx.insert(mod.schema.leads).values({ organizationId: orgB.id, stageId: stageNewB.id, name: "Hijack" }),
        ),
      ).rejects.toThrow();
    });

    it("a user cannot update another organization's lead via RLS", async () => {
      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.update(mod.schema.leads).set({ name: "Hijacked" }).where(mod.eq(mod.schema.leads.id, leadB.id)).returning(),
      );
      expect(rows).toEqual([]);
      const [stillB] = await mod.db.select().from(mod.schema.leads).where(mod.eq(mod.schema.leads.id, leadB.id));
      expect(stillB.name).toBe("Lead B");
    });

    it("unlike knowledge documents, leads.delete is a real permission — a company CAN permanently delete its own lead via RLS", async () => {
      const [temp] = await mod.db
        .insert(mod.schema.leads)
        .values({ organizationId: orgA.id, stageId: stageNewA.id, name: "Temp lead" })
        .returning();

      const deleted = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.delete(mod.schema.leads).where(mod.eq(mod.schema.leads.id, temp.id)).returning(),
      );
      expect(deleted).toHaveLength(1);
    });

    it("a user cannot delete another organization's lead via RLS", async () => {
      const deleted = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.delete(mod.schema.leads).where(mod.eq(mod.schema.leads.id, leadB.id)).returning(),
      );
      expect(deleted).toEqual([]);
      const [stillThere] = await mod.db.select().from(mod.schema.leads).where(mod.eq(mod.schema.leads.id, leadB.id));
      expect(stillThere).toBeDefined();
    });
  });

  describe("lead_tags / lead_notes RLS", () => {
    it("insert is scoped: own org succeeds, foreign org is rejected", async () => {
      await expect(
        mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
          tx.insert(mod.schema.leadTags).values({ organizationId: orgB.id, leadId: leadB.id, tag: "hijack" }),
        ),
      ).rejects.toThrow();

      const [inserted] = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .insert(mod.schema.leadTags)
          .values({ organizationId: orgA.id, leadId: leadA.id, tag: "hot-lead", createdBy: userA.id })
          .returning(),
      );
      expect(inserted.organizationId).toBe(orgA.id);
    });

    it("a company can delete its own tag but not another org's tag", async () => {
      const [ownTag] = await mod.db
        .select()
        .from(mod.schema.leadTags)
        .where(mod.eq(mod.schema.leadTags.leadId, leadA.id));

      const rejectedDelete = await mod.withRlsContext(userB.id, (tx: typeof mod.db) =>
        tx.delete(mod.schema.leadTags).where(mod.eq(mod.schema.leadTags.id, ownTag.id)).returning(),
      );
      expect(rejectedDelete).toEqual([]);

      const allowedDelete = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.delete(mod.schema.leadTags).where(mod.eq(mod.schema.leadTags.id, ownTag.id)).returning(),
      );
      expect(allowedDelete).toHaveLength(1);
    });

    it("no UPDATE policy on lead_notes — an UPDATE via RLS context changes nothing", async () => {
      const [note] = await mod.db
        .insert(mod.schema.leadNotes)
        .values({ organizationId: orgA.id, leadId: leadA.id, authorUserId: userA.id, content: "Original note" })
        .returning();

      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .update(mod.schema.leadNotes)
          .set({ content: "Edited" })
          .where(mod.eq(mod.schema.leadNotes.id, note.id))
          .returning(),
      );
      expect(rows).toEqual([]);

      const [stillOriginal] = await mod.db
        .select()
        .from(mod.schema.leadNotes)
        .where(mod.eq(mod.schema.leadNotes.id, note.id));
      expect(stillOriginal.content).toBe("Original note");
    });
  });

  describe("lead_assignments / lead_stage_history / lead_scores / lead_activity (append-only)", () => {
    const appendOnlyTables = [
      {
        name: "lead_activity",
        table: () => mod.schema.leadActivity,
        insertExtra: () => ({ type: "lead_created", actorUserId: userA.id }),
      },
      {
        name: "lead_assignments",
        table: () => mod.schema.leadAssignments,
        insertExtra: () => ({ previousAssigneeId: null, newAssigneeId: userA.id, changedByUserId: userA.id }),
      },
      {
        name: "lead_stage_history",
        table: () => mod.schema.leadStageHistory,
        insertExtra: () => ({ previousStageId: null, newStageId: stageNewA.id, changedByUserId: userA.id }),
      },
      {
        name: "lead_scores",
        table: () => mod.schema.leadScores,
        insertExtra: () => ({ signals: { manualAdjustment: 0 }, totalScore: 10 }),
      },
    ];

    it.each(appendOnlyTables)(
      "$name: insert is scoped, and no UPDATE/DELETE policy exists",
      async ({ table: getTable, insertExtra }) => {
        const table = getTable();

        // foreign org insert rejected
        await expect(
          mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
            tx.insert(table).values({ organizationId: orgB.id, leadId: leadB.id, ...insertExtra() }),
          ),
        ).rejects.toThrow();

        // own org insert allowed
        const [inserted] = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
          tx.insert(table).values({ organizationId: orgA.id, leadId: leadA.id, ...insertExtra() }).returning(),
        );
        expect(inserted.organizationId).toBe(orgA.id);

        // no UPDATE policy
        const updated = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
          tx.update(table).set({ organizationId: orgA.id }).where(mod.eq(table.id, inserted.id)).returning(),
        );
        expect(updated).toEqual([]);

        // no DELETE policy
        const deleted = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
          tx.delete(table).where(mod.eq(table.id, inserted.id)).returning(),
        );
        expect(deleted).toEqual([]);
      },
    );

    it("a user cannot read another org's lead_activity", async () => {
      await mod.db
        .insert(mod.schema.leadActivity)
        .values({ organizationId: orgB.id, leadId: leadB.id, type: "lead_created" });

      const rows = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx.select().from(mod.schema.leadActivity).where(mod.eq(mod.schema.leadActivity.leadId, leadB.id)),
      );
      expect(rows).toEqual([]);
    });
  });

  describe("conversations_update_by_agent / conversation_messages_insert_by_agent (new Phase 6 policies)", () => {
    it("an authenticated company user can now update their own org's conversation (Human Takeover)", async () => {
      const [session] = await mod.db
        .insert(mod.schema.conversationSessions)
        .values({ organizationId: orgA.id, widgetId: widgetA.id, visitorId: crypto.randomUUID() })
        .returning();
      const [conversation] = await mod.db
        .insert(mod.schema.conversations)
        .values({ organizationId: orgA.id, widgetId: widgetA.id, sessionId: session.id })
        .returning();

      const updated = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .update(mod.schema.conversations)
          .set({ owner: "human", assignedUserId: userA.id })
          .where(mod.eq(mod.schema.conversations.id, conversation.id))
          .returning(),
      );
      expect(updated).toHaveLength(1);
      expect(updated[0].owner).toBe("human");
    });

    it("rejects updating another organization's conversation", async () => {
      const [widgetB] = await mod.db
        .insert(mod.schema.widgets)
        .values({ organizationId: orgB.id, name: "Widget B", status: "active", createdBy: userB.id })
        .returning();
      const [sessionB] = await mod.db
        .insert(mod.schema.conversationSessions)
        .values({ organizationId: orgB.id, widgetId: widgetB.id, visitorId: crypto.randomUUID() })
        .returning();
      const [conversationB] = await mod.db
        .insert(mod.schema.conversations)
        .values({ organizationId: orgB.id, widgetId: widgetB.id, sessionId: sessionB.id })
        .returning();

      const updated = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .update(mod.schema.conversations)
          .set({ owner: "human" })
          .where(mod.eq(mod.schema.conversations.id, conversationB.id))
          .returning(),
      );
      expect(updated).toEqual([]);
    });

    it("an authenticated company user can insert a reply message into their own org's conversation", async () => {
      const [session] = await mod.db
        .insert(mod.schema.conversationSessions)
        .values({ organizationId: orgA.id, widgetId: widgetA.id, visitorId: crypto.randomUUID() })
        .returning();
      const [conversation] = await mod.db
        .insert(mod.schema.conversations)
        .values({ organizationId: orgA.id, widgetId: widgetA.id, sessionId: session.id })
        .returning();

      const inserted = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
        tx
          .insert(mod.schema.conversationMessages)
          .values({
            organizationId: orgA.id,
            conversationId: conversation.id,
            role: "assistant",
            content: "A human reply",
            status: "complete",
          })
          .returning(),
      );
      expect(inserted).toHaveLength(1);
      // provider/model null is exactly what distinguishes a human-authored
      // reply from an AI one throughout the Inbox/Conversation UI.
      expect(inserted[0].provider).toBeNull();
    });

    it("rejects inserting a message tagged with a foreign organization_id", async () => {
      await expect(
        mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
          tx.insert(mod.schema.conversationMessages).values({
            organizationId: orgB.id,
            conversationId: "00000000-0000-0000-0000-000000000000",
            role: "assistant",
            content: "hijack",
          }),
        ),
      ).rejects.toThrow();
    });
  });

  describe("Human Takeover pipeline (real DB, no LLM call)", () => {
    it("a conversation already owned by a human stores the visitor's message but never calls the AI provider", async () => {
      const visitorId = crypto.randomUUID();
      const [session] = await mod.db
        .insert(mod.schema.conversationSessions)
        .values({ organizationId: orgA.id, widgetId: widgetA.id, visitorId })
        .returning();
      const [conversation] = await mod.db
        .insert(mod.schema.conversations)
        .values({
          organizationId: orgA.id,
          widgetId: widgetA.id,
          sessionId: session.id,
          owner: "human",
          assignedUserId: agentUser.id,
          takeoverReason: "manual",
          takeoverAt: new Date(),
        })
        .returning();

      const events: unknown[] = [];
      const transport = { send: (e: unknown) => events.push(e), close: () => {} };

      await mod.handleIncomingMessage(
        { key: keyA.publicKey, visitorId, conversationId: conversation.id, message: "Still there?" },
        null,
        transport,
        new AbortController().signal,
      );

      expect(events).toContainEqual({
        type: "handoff",
        message: "Thanks for your message — a team member will get back to you shortly.",
      });
      expect(events.some((e) => (e as { type: string }).type === "token")).toBe(false);
      expect(events.some((e) => (e as { type: string }).type === "error")).toBe(false);

      const messages = await mod.db
        .select()
        .from(mod.schema.conversationMessages)
        .where(mod.eq(mod.schema.conversationMessages.conversationId, conversation.id));
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("user");
      expect(messages[0].content).toBe("Still there?");
    });
  });

  describe("assertLeadBelongsToOrg agent-scoping (real DB)", () => {
    it("allows an agent to access a lead assigned to them", async () => {
      await expect(
        mod.withRlsContext(agentUser.id, (tx: typeof mod.db) =>
          mod.assertLeadBelongsToOrg(tx, leadAssignedToAgent.id, {
            userId: agentUser.id,
            organizationId: orgA.id,
            organizationStatus: "active",
            role: "agent",
          }),
        ),
      ).resolves.toBeUndefined();
    });

    it("allows an agent to access an unassigned lead", async () => {
      await expect(
        mod.withRlsContext(agentUser.id, (tx: typeof mod.db) =>
          mod.assertLeadBelongsToOrg(tx, leadA.id, {
            userId: agentUser.id,
            organizationId: orgA.id,
            organizationStatus: "active",
            role: "agent",
          }),
        ),
      ).resolves.toBeUndefined();
    });

    it("blocks a different agent from a lead assigned to someone else", async () => {
      await expect(
        mod.withRlsContext(otherAgentUser.id, (tx: typeof mod.db) =>
          mod.assertLeadBelongsToOrg(tx, leadAssignedToAgent.id, {
            userId: otherAgentUser.id,
            organizationId: orgA.id,
            organizationStatus: "active",
            role: "agent",
          }),
        ),
      ).rejects.toThrow("Lead not found");
    });

    it("does not restrict an owner from a lead assigned to someone else", async () => {
      await expect(
        mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
          mod.assertLeadBelongsToOrg(tx, leadAssignedToAgent.id, {
            userId: userA.id,
            organizationId: orgA.id,
            organizationStatus: "active",
            role: "owner",
          }),
        ),
      ).resolves.toBeUndefined();
    });
  });
});
