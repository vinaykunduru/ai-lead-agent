import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { type RlsDb, withRlsContext } from "@/db/client";
import { widgetKeys, type WidgetKey } from "@/db/schema";
import { requireCompanySession, type CompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { recordAuditLog } from "@/modules/audit/service";
import { assertWidgetBelongsToOrg } from "./shared";

const PUBLIC_KEY_PREFIX = "wgt_pub_";

/**
 * Opaque, unguessable, and unrelated to widgets.id — a public key must
 * never be derivable from (or reversible to) the internal widget or
 * organization id it resolves to. See CLAUDE.md §4.
 */
function generatePublicKey(): string {
  return `${PUBLIC_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
}

/**
 * Every widget gets exactly one active key at creation time. Called inside
 * the same RLS transaction as widget creation (widgets-service.ts) so a
 * widget never briefly exists without a working install key.
 */
export async function createInitialKey(
  tx: RlsDb,
  session: CompanySession,
  widgetId: string,
): Promise<WidgetKey> {
  const [key] = await tx
    .insert(widgetKeys)
    .values({ organizationId: session.organizationId, widgetId, publicKey: generatePublicKey() })
    .returning();
  return key;
}

export async function listWidgetKeys(widgetId: string): Promise<WidgetKey[]> {
  const session = await requireCompanySession();
  assertPermission(session, "widget.view");

  return withRlsContext(session.userId, async (tx) => {
    await assertWidgetBelongsToOrg(tx, widgetId, session.organizationId);
    return tx
      .select()
      .from(widgetKeys)
      .where(and(eq(widgetKeys.widgetId, widgetId), eq(widgetKeys.organizationId, session.organizationId)))
      .orderBy(desc(widgetKeys.createdAt));
  });
}

/**
 * Revokes the current active key and issues a new one, in the same
 * transaction — "Rotate keys" + "Disable old keys" from the module spec.
 * The old row is kept (status='revoked'), never deleted, so key history
 * stays intact for audit purposes.
 */
export async function rotateWidgetKey(widgetId: string): Promise<WidgetKey> {
  const session = await requireCompanySession();
  assertPermission(session, "widget.update");

  const newKey = await withRlsContext(session.userId, async (tx) => {
    await assertWidgetBelongsToOrg(tx, widgetId, session.organizationId);
    await tx
      .update(widgetKeys)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(
        and(
          eq(widgetKeys.widgetId, widgetId),
          eq(widgetKeys.organizationId, session.organizationId),
          eq(widgetKeys.status, "active"),
        ),
      );
    return createInitialKey(tx, session, widgetId);
  });

  await recordAuditLog({
    organizationId: session.organizationId,
    actorUserId: session.userId,
    actorType: "company_user",
    action: "widget.key_rotated",
    resourceType: "widget",
    resourceId: widgetId,
    // Never the key value itself.
    metadata: { newKeyId: newKey.id },
  });

  return newKey;
}
