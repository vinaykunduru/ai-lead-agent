import type { membershipRoleEnum } from "@/db/schema/memberships";
import { PERMISSIONS, type Permission } from "./constants";

export type Role = (typeof membershipRoleEnum.enumValues)[number];

const ALL_PERMISSIONS: readonly Permission[] = PERMISSIONS;

/**
 * Single source of truth for what each role can do. Nothing in the app
 * should branch on `role === "admin"` directly — always go through
 * `can()` / `hasPermission()` below so this map is the only place role
 * semantics live. See CLAUDE.md §2.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  // Full company access, including ownership-level actions (e.g. company.manage).
  owner: ALL_PERMISSIONS,

  // Everything except ownership-level actions.
  admin: ALL_PERMISSIONS.filter((permission) => permission !== "company.manage"),

  // Leads, conversations, team visibility, and reports. No leads.delete —
  // matches the widget.delete pattern (owner/admin only), granted only via
  // ALL_PERMISSIONS above.
  manager: [
    "company.view",
    "users.view",
    "leads.view",
    "leads.create",
    "leads.update",
    "leads.assign",
    "conversations.view",
    "inbox.view",
    "inbox.reply",
  ],

  // Assigned leads and conversations only. Which leads/conversations an
  // agent may act on is a resource-level (ownership) check performed by the
  // leads/conversations services, not a role permission — see
  // modules/leads and modules/inbox.
  agent: ["leads.view", "leads.update", "conversations.view", "inbox.view", "inbox.reply"],

  // Read-only dashboard access. knowledge.search is included because
  // running a search doesn't mutate anything — it's a read operation.
  viewer: [
    "company.view",
    "users.view",
    "leads.view",
    "conversations.view",
    "knowledge.view",
    "knowledge.search",
    "ai.view",
    "widget.view",
    "inbox.view",
  ],
};
