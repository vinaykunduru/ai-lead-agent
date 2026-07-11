import { describe, expect, it } from "vitest";
import { assertConversationAccessible } from "./shared";
import type { Conversation } from "@/db/schema";
import type { CompanySession } from "@/lib/auth/session";

function conversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "conv-1",
    organizationId: "org-1",
    widgetId: "widget-1",
    sessionId: "session-1",
    status: "active",
    owner: "ai",
    assignedUserId: null,
    takeoverReason: null,
    takeoverAt: null,
    lastReadAt: null,
    startedAt: new Date(),
    endedAt: null,
    lastActivityAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function session(overrides: Partial<CompanySession> = {}): CompanySession {
  return {
    userId: "user-agent",
    organizationId: "org-1",
    organizationStatus: "active",
    role: "agent",
    ...overrides,
  };
}

describe("assertConversationAccessible", () => {
  it("allows an agent to access an unassigned conversation", () => {
    expect(() => assertConversationAccessible(conversation({ assignedUserId: null }), session())).not.toThrow();
  });

  it("allows an agent to access a conversation assigned to them", () => {
    expect(() =>
      assertConversationAccessible(conversation({ assignedUserId: "user-agent" }), session({ userId: "user-agent" })),
    ).not.toThrow();
  });

  it("blocks an agent from a conversation assigned to a different agent", () => {
    expect(() =>
      assertConversationAccessible(
        conversation({ assignedUserId: "user-other-agent" }),
        session({ userId: "user-agent" }),
      ),
    ).toThrow("Conversation not found");
  });

  it("does not restrict a manager, owner, admin, or viewer role", () => {
    const assignedToSomeoneElse = conversation({ assignedUserId: "user-other-agent" });
    for (const role of ["manager", "owner", "admin", "viewer"] as const) {
      expect(() =>
        assertConversationAccessible(assignedToSomeoneElse, session({ userId: "user-current", role })),
      ).not.toThrow();
    }
  });
});
