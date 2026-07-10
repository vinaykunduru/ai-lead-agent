import type { Permission } from "./constants";
import { ROLE_PERMISSIONS, type Role } from "./roles";

export type PermissionSubject = { role: Role };

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * The single entry point for authorization checks throughout the app —
 * Server Actions, Route Handlers, and Server Components should all call this
 * instead of comparing `role` directly. See CLAUDE.md §2.
 */
export function can(subject: PermissionSubject, permission: Permission): boolean {
  return hasPermission(subject.role, permission);
}

export function assertPermission(subject: PermissionSubject, permission: Permission): void {
  if (!can(subject, permission)) {
    throw new Error(`Forbidden: missing permission "${permission}"`);
  }
}
