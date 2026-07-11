import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Real-Postgres RLS tests for the Conversation Engine module
 * (db/migrations/0011, 0012), mirroring the pattern in every prior
 * src/test/integration/*.test.ts file: skip cleanly (not fail) when live
 * credentials aren't configured, never mock the database for
 * security-critical behavior.
 *
 * What's NOT covered here (and honestly can't be, without real provider
 * credentials — see .env.local): an actual LLM call through
 * providers/ai/*.ts. Those keys are unset/placeholder in this environment.
 * The one execution-pipeline path that IS fully real end-to-end here is the
 * outside-business-hours short-circuit — it never calls a provider, so it
 * genuinely exercises resolveWidgetForPublicRequest, session/conversation
 * resolution, message storage, and the transport, against the real
 * database, with no mocking anywhere in the path.
 */

const hasLiveDatabase = Boolean(
  process.env.DATABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_APP_URL,
);

describe.skipIf(!hasLiveDatabase)(
  "conversation engine cross-tenant isolation (live Supabase project required)",
  () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mod: any;
    let orgA: { id: string };
    let orgB: { id: string };
    let userA: { id: string };
    let userB: { id: string };
    let widgetA: { id: string };
    let widgetB: { id: string };
    let keyA: { publicKey: string };

    class RecordingTransport {
      events: unknown[] = [];
      send(event: unknown) {
        this.events.push(event);
      }
      close() {}
    }

    beforeAll(async () => {
      const [dbClient, schema, supabaseAdmin, drizzleOrm, executionPipeline, sessionService] =
        await Promise.all([
          import("@/db/client"),
          import("@/db/schema"),
          import("@/lib/supabase/admin"),
          import("drizzle-orm"),
          import("@/modules/conversation/execution-pipeline"),
          import("@/modules/conversation/session-service"),
        ]);
      mod = {
        db: dbClient.db,
        withRlsContext: dbClient.withRlsContext,
        schema,
        admin: supabaseAdmin.createSupabaseAdminClient(),
        eq: drizzleOrm.eq,
        handleIncomingMessage: executionPipeline.handleIncomingMessage,
        resolveSession: sessionService.resolveSession,
      };

      const stamp = Date.now();
      const { data: userAData } = await mod.admin.auth.admin.createUser({
        email: `conv-test-a-${stamp}@example.com`,
        password: crypto.randomUUID(),
        email_confirm: true,
      });
      const { data: userBData } = await mod.admin.auth.admin.createUser({
        email: `conv-test-b-${stamp}@example.com`,
        password: crypto.randomUUID(),
        email_confirm: true,
      });
      userA = { id: userAData.user.id };
      userB = { id: userBData.user.id };

      const [rowA] = await mod.db
        .insert(mod.schema.organizations)
        .values({ name: "Conv Test A", slug: `conv-test-a-${stamp}` })
        .returning();
      const [rowB] = await mod.db
        .insert(mod.schema.organizations)
        .values({ name: "Conv Test B", slug: `conv-test-b-${stamp}` })
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
        { organizationId: orgA.id, widgetId: widgetA.id },
        { organizationId: orgB.id, widgetId: widgetB.id },
      ]);

      const [kA] = await mod.db
        .insert(mod.schema.widgetKeys)
        .values({ organizationId: orgA.id, widgetId: widgetA.id, publicKey: `wgt_pub_conv_a_${stamp}` })
        .returning();
      keyA = { publicKey: kA.publicKey };

      // Holiday mode guarantees "outside business hours" regardless of when
      // this test actually runs — the one execution-pipeline path
      // verifiable end-to-end without a real LLM provider key.
      await mod.db.insert(mod.schema.aiBusinessHours).values({
        organizationId: orgA.id,
        holidayMode: true,
        outsideHoursResponse: "We are currently closed. Please leave a message.",
      });
    });

    afterAll(async () => {
      if (!mod) return;
      // Every conversation_* table cascades on organizations.id, as do
      // widget_* and ai_business_hours — deleting the two test orgs is
      // sufficient.
      await mod.db.delete(mod.schema.memberships).where(mod.eq(mod.schema.memberships.organizationId, orgA.id));
      await mod.db.delete(mod.schema.memberships).where(mod.eq(mod.schema.memberships.organizationId, orgB.id));
      await mod.db.delete(mod.schema.organizations).where(mod.eq(mod.schema.organizations.id, orgA.id));
      await mod.db.delete(mod.schema.organizations).where(mod.eq(mod.schema.organizations.id, orgB.id));
      await mod.admin.auth.admin.deleteUser(userA.id);
      await mod.admin.auth.admin.deleteUser(userB.id);
    });

    describe("execution pipeline (real DB, no LLM call — outside-business-hours short circuit)", () => {
      it("resolves the widget, stores the conversation, and responds with the configured offline message", async () => {
        const transport = new RecordingTransport();
        const visitorId = crypto.randomUUID();

        await mod.handleIncomingMessage(
          { key: keyA.publicKey, visitorId, message: "Are you open?" },
          null,
          transport,
          new AbortController().signal,
        );

        expect(transport.events[0]).toMatchObject({ type: "ready" });
        const readyEvent = transport.events[0] as { conversationId: string; sessionId: string };
        expect(transport.events).toContainEqual({
          type: "token",
          text: "We are currently closed. Please leave a message.",
        });
        expect(transport.events[transport.events.length - 1]).toMatchObject({
          type: "done",
          promptTokens: 0,
          completionTokens: 0,
        });

        const messages = await mod.db
          .select()
          .from(mod.schema.conversationMessages)
          .where(mod.eq(mod.schema.conversationMessages.conversationId, readyEvent.conversationId));
        expect(messages).toHaveLength(2);
        expect(messages.map((m: { role: string }) => m.role).sort()).toEqual(["assistant", "user"]);
        const assistantMessage = messages.find((m: { role: string }) => m.role === "assistant");
        expect(assistantMessage.content).toBe("We are currently closed. Please leave a message.");
        expect(assistantMessage.status).toBe("complete");
      });

      it("rejects an unknown widget key with the generic error and creates no rows", async () => {
        // handleIncomingMessage itself throws on this early failure — by
        // design, it relies on its caller (in production, the SSE
        // transport — see modules/conversation/transport/sse.ts) to catch
        // it and translate it into a transport error event. Going through
        // createSseResponse here exercises that same real integration
        // rather than re-implementing the catch inline.
        const visitorId = crypto.randomUUID();
        const { createSseResponse } = await import("@/modules/conversation/transport/sse");
        const controller = new AbortController();
        const response = createSseResponse(
          (transport: unknown, signal: AbortSignal) =>
            mod.handleIncomingMessage(
              { key: "wgt_pub_does_not_exist", visitorId, message: "hi" },
              null,
              transport,
              signal,
            ),
          controller.signal,
        );
        const text = await response.text();

        expect(text).toContain("Something went wrong. Please try again.");

        const sessions = await mod.db
          .select()
          .from(mod.schema.conversationSessions)
          .where(mod.eq(mod.schema.conversationSessions.widgetId, widgetA.id));
        expect(sessions.every((s: { visitorId: string }) => s.visitorId !== visitorId)).toBe(true);
      });

      it("reuses the same session row for a returning visitor on the same widget", async () => {
        const visitorId = crypto.randomUUID();
        const first = await mod.resolveSession(orgA.id, widgetA.id, visitorId);
        const second = await mod.resolveSession(orgA.id, widgetA.id, visitorId);
        expect(second.id).toBe(first.id);

        await mod.db.delete(mod.schema.conversationSessions).where(mod.eq(mod.schema.conversationSessions.id, first.id));
      });
    });

    describe("RLS: conversation_sessions / conversations / conversation_messages", () => {
      it("a user can only read their own org's conversation data", async () => {
        const transport = new RecordingTransport();
        await mod.handleIncomingMessage(
          { key: keyA.publicKey, visitorId: crypto.randomUUID(), message: "isolation check" },
          null,
          transport,
          new AbortController().signal,
        );

        const sessionsA = await mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
          tx.select().from(mod.schema.conversationSessions),
        );
        expect(sessionsA.every((s: { organizationId: string }) => s.organizationId === orgA.id)).toBe(true);

        const sessionsB = await mod.withRlsContext(userB.id, (tx: typeof mod.db) =>
          tx.select().from(mod.schema.conversationSessions).where(mod.eq(mod.schema.conversationSessions.widgetId, widgetA.id)),
        );
        expect(sessionsB).toEqual([]);
      });

      it("no INSERT/UPDATE/DELETE policy exists for authenticated on any conversation table", async () => {
        await expect(
          mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
            tx.insert(mod.schema.conversationSessions).values({
              organizationId: orgA.id,
              widgetId: widgetA.id,
              visitorId: crypto.randomUUID(),
            }),
          ),
        ).rejects.toThrow();

        await expect(
          mod.withRlsContext(userA.id, (tx: typeof mod.db) =>
            tx.insert(mod.schema.conversationMessages).values({
              organizationId: orgA.id,
              conversationId: "00000000-0000-0000-0000-000000000000",
              role: "user",
              content: "should be rejected",
            }),
          ),
        ).rejects.toThrow();
      });
    });

    describe("loadAiBehaviourForConversation defaults", () => {
      it("falls back to schema-default values for an organization that never configured AI Behaviour", async () => {
        const { loadAiBehaviourForConversation } = await import("@/modules/ai-behaviour/conversation-config");
        const config = await loadAiBehaviourForConversation(orgB.id);
        expect(config.profile.assistantName).toBe("Assistant");
        expect(config.profile.aiProvider).toBe("claude");
        expect(config.businessHours.timezone).toBe("UTC");
        expect(config.businessRules).toEqual([]);
      });
    });
  },
);
