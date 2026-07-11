import { describe, expect, it } from "vitest";
import { can, hasPermission } from "./can";
import { ROLE_PERMISSIONS } from "./roles";
import { PERMISSIONS } from "./constants";

describe("permissions", () => {
  it("owner has every permission", () => {
    for (const permission of PERMISSIONS) {
      expect(hasPermission("owner", permission)).toBe(true);
    }
  });

  it("admin has every permission except company.manage (ownership-level)", () => {
    expect(hasPermission("admin", "company.manage")).toBe(false);
    for (const permission of PERMISSIONS) {
      if (permission === "company.manage") continue;
      expect(hasPermission("admin", permission)).toBe(true);
    }
  });

  it("viewer cannot perform any write action", () => {
    const writePermissions = PERMISSIONS.filter(
      (p) =>
        p.endsWith(".manage") ||
        p.endsWith(".create") ||
        p.endsWith(".update") ||
        p.endsWith(".delete") ||
        p.endsWith(".reprocess") ||
        p.endsWith(".publish"),
    );
    for (const permission of writePermissions) {
      expect(hasPermission("viewer", permission)).toBe(false);
    }
  });

  it("viewer can view every module it has visibility into", () => {
    expect(hasPermission("viewer", "company.view")).toBe(true);
    expect(hasPermission("viewer", "leads.view")).toBe(true);
    expect(hasPermission("viewer", "conversations.view")).toBe(true);
    expect(hasPermission("viewer", "knowledge.view")).toBe(true);
    expect(hasPermission("viewer", "ai.view")).toBe(true);
    expect(hasPermission("viewer", "widget.view")).toBe(true);
  });

  it("agent is scoped to leads and conversations only", () => {
    expect(hasPermission("agent", "leads.view")).toBe(true);
    expect(hasPermission("agent", "conversations.view")).toBe(true);
    expect(hasPermission("agent", "knowledge.view")).toBe(false);
    expect(hasPermission("agent", "widget.update")).toBe(false);
    expect(hasPermission("agent", "users.manage")).toBe(false);
  });

  it("manager can manage leads but not knowledge, ai behaviour, or the widget", () => {
    expect(hasPermission("manager", "leads.manage")).toBe(true);
    expect(hasPermission("manager", "conversations.view")).toBe(true);
    expect(hasPermission("manager", "knowledge.view")).toBe(false);
    expect(hasPermission("manager", "knowledge.create")).toBe(false);
    expect(hasPermission("manager", "ai.update")).toBe(false);
    expect(hasPermission("manager", "widget.update")).toBe(false);
    expect(hasPermission("manager", "users.manage")).toBe(false);
  });

  it("only owner and admin can update AI Behaviour configuration or use the playground", () => {
    expect(hasPermission("owner", "ai.update")).toBe(true);
    expect(hasPermission("owner", "ai.test")).toBe(true);
    expect(hasPermission("admin", "ai.update")).toBe(true);
    expect(hasPermission("admin", "ai.test")).toBe(true);
    expect(hasPermission("viewer", "ai.update")).toBe(false);
    expect(hasPermission("viewer", "ai.test")).toBe(false);
    expect(hasPermission("manager", "ai.test")).toBe(false);
    expect(hasPermission("agent", "ai.view")).toBe(false);
  });

  it("only owner and admin can create, update, delete, or publish widgets", () => {
    for (const permission of ["widget.create", "widget.update", "widget.delete", "widget.publish"] as const) {
      expect(hasPermission("owner", permission)).toBe(true);
      expect(hasPermission("admin", permission)).toBe(true);
      expect(hasPermission("viewer", permission)).toBe(false);
      expect(hasPermission("manager", permission)).toBe(false);
      expect(hasPermission("agent", permission)).toBe(false);
    }
  });

  it("can() defers entirely to the role map, no other logic", () => {
    for (const role of Object.keys(ROLE_PERMISSIONS) as (keyof typeof ROLE_PERMISSIONS)[]) {
      for (const permission of PERMISSIONS) {
        expect(can({ role }, permission)).toBe(ROLE_PERMISSIONS[role].includes(permission));
      }
    }
  });
});
