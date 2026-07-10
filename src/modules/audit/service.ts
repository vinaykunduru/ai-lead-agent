import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { auditLogs, type AuditLog } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";

export type AuditActorType = "platform_admin" | "company_user" | "system";

export type AuditLogEntry = {
  organizationId?: string | null;
  actorUserId?: string | null;
  actorType: AuditActorType;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  /** Safe metadata only — never secrets, tokens, or full request bodies. */
  metadata?: Record<string, unknown>;
};

/**
 * Append-only by convention: this is the only function in the codebase that
 * writes to audit_logs, and it never updates or deletes. RLS backs this up
 * at the database level (see db/migrations/0001) — no UPDATE/DELETE policy
 * exists for any role other than service_role.
 */
export async function recordAuditLog(entry: AuditLogEntry): Promise<void> {
  await db.insert(auditLogs).values({
    organizationId: entry.organizationId ?? null,
    actorUserId: entry.actorUserId ?? null,
    actorType: entry.actorType,
    action: entry.action,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId ?? null,
    metadata: entry.metadata ?? {},
  });
}

const AUDIT_LOG_PAGE_SIZE = 100;

/**
 * Platform-admin only. Reading audit_logs always goes through this function
 * rather than a direct query from a page/component — see CLAUDE.md §6.
 */
export async function listAuditLogs(filter?: { organizationId?: string }): Promise<AuditLog[]> {
  await requirePlatformAdmin();

  const query = db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(AUDIT_LOG_PAGE_SIZE);

  if (filter?.organizationId) {
    return query.where(eq(auditLogs.organizationId, filter.organizationId));
  }

  return query;
}
