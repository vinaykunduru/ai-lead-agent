import "server-only";
import { count, desc, eq } from "drizzle-orm";
import { db, withRlsContext } from "@/db/client";
import { memberships, organizations, type Organization } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import { requireCompanySession } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env.public";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordAuditLog } from "@/modules/audit/service";
import type {
  CreateCompanyInput,
  CreateFirstOwnerInput,
  UpdateCompanyInput,
  UpdateCompanyStatusInput,
} from "./validation";

/**
 * Every function here is a platform-admin operation: organizations has no
 * RLS write policy for the "authenticated" role (see db/migrations/0001),
 * so these deliberately use the service-role `db` client, not
 * withRlsContext. Each one re-verifies platform admin status itself — see
 * CLAUDE.md §9 ("every Server Action / service function re-verifies").
 */

export type CreateCompanyResult =
  | { ok: true; data: Organization }
  | { ok: false; error: "slug_taken" };

/** Empty-string form fields mean "not provided" — normalize before storage. */
function emptyToUndefined(value: string): string | undefined {
  return value === "" ? undefined : value;
}

export async function createCompany(input: CreateCompanyInput): Promise<CreateCompanyResult> {
  const admin = await requirePlatformAdmin();

  const existing = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, input.slug))
    .limit(1);
  if (existing.length > 0) {
    return { ok: false, error: "slug_taken" };
  }

  const [org] = await db
    .insert(organizations)
    .values({
      name: input.name,
      slug: input.slug,
      website: emptyToUndefined(input.website),
      industry: emptyToUndefined(input.industry),
      timezone: input.timezone,
    })
    .returning();

  await recordAuditLog({
    actorUserId: admin.userId,
    actorType: "platform_admin",
    action: "company.created",
    resourceType: "organization",
    resourceId: org.id,
    metadata: { name: org.name, slug: org.slug },
  });

  return { ok: true, data: org };
}

export async function updateCompany(input: UpdateCompanyInput): Promise<Organization> {
  const admin = await requirePlatformAdmin();

  const [org] = await db
    .update(organizations)
    .set({
      name: input.name,
      website: emptyToUndefined(input.website),
      industry: emptyToUndefined(input.industry),
      timezone: input.timezone,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, input.organizationId))
    .returning();

  if (!org) {
    throw new Error("Company not found");
  }

  await recordAuditLog({
    actorUserId: admin.userId,
    actorType: "platform_admin",
    action: "company.updated",
    resourceType: "organization",
    resourceId: org.id,
    metadata: { name: org.name },
  });

  return org;
}

export async function updateCompanyStatus(
  input: UpdateCompanyStatusInput,
): Promise<Organization> {
  const admin = await requirePlatformAdmin();

  const [org] = await db
    .update(organizations)
    .set({ status: input.status, updatedAt: new Date() })
    .where(eq(organizations.id, input.organizationId))
    .returning();

  if (!org) {
    throw new Error("Company not found");
  }

  const actionByStatus: Record<Organization["status"], string> = {
    active: "company.activated",
    suspended: "company.suspended",
    trial: "company.status_changed",
  };

  await recordAuditLog({
    actorUserId: admin.userId,
    actorType: "platform_admin",
    action: actionByStatus[org.status],
    resourceType: "organization",
    resourceId: org.id,
    metadata: { status: org.status },
  });

  return org;
}

export async function listCompanies(): Promise<Organization[]> {
  await requirePlatformAdmin();
  return db.select().from(organizations).orderBy(desc(organizations.createdAt));
}

export async function getCompanyById(organizationId: string): Promise<Organization | null> {
  await requirePlatformAdmin();
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  return org ?? null;
}

export type CompanyUserRow = {
  membershipId: string;
  userId: string;
  role: string;
  status: string;
  email: string | null;
  createdAt: Date;
};

export async function listCompanyUsers(organizationId: string): Promise<CompanyUserRow[]> {
  await requirePlatformAdmin();

  const rows = await db
    .select({
      membershipId: memberships.id,
      userId: memberships.userId,
      role: memberships.role,
      status: memberships.status,
      createdAt: memberships.createdAt,
    })
    .from(memberships)
    .where(eq(memberships.organizationId, organizationId))
    .orderBy(desc(memberships.createdAt));

  if (rows.length === 0) return [];

  // Emails live in Supabase Auth, not our schema — resolve them via the
  // admin client rather than duplicating auth.users data into our tables.
  const supabaseAdmin = createSupabaseAdminClient();
  const emailByUserId = new Map<string, string | null>();
  await Promise.all(
    rows.map(async (row) => {
      const { data } = await supabaseAdmin.auth.admin.getUserById(row.userId);
      emailByUserId.set(row.userId, data.user?.email ?? null);
    }),
  );

  return rows.map((row) => ({ ...row, email: emailByUserId.get(row.userId) ?? null }));
}

export type CreateFirstOwnerResult =
  | { ok: true }
  | {
      ok: false;
      error: "already_has_owner" | "company_suspended" | "invite_failed";
      message?: string;
    };

/**
 * Platform admin creates the first company owner. No public self-signup
 * exists for the company side (see CLAUDE.md §3.5) — this invite is the only
 * way a company user gets provisioned in Phase 1.
 */
export async function createFirstOwner(
  input: CreateFirstOwnerInput,
): Promise<CreateFirstOwnerResult> {
  const admin = await requirePlatformAdmin();

  const [org] = await db
    .select({ status: organizations.status })
    .from(organizations)
    .where(eq(organizations.id, input.organizationId))
    .limit(1);
  if (!org) {
    return { ok: false, error: "invite_failed", message: "Company not found" };
  }
  if (org.status === "suspended") {
    return { ok: false, error: "company_suspended" };
  }

  const existingOwner = await db
    .select({ id: memberships.id })
    .from(memberships)
    .where(eq(memberships.organizationId, input.organizationId))
    .limit(1);
  if (existingOwner.length > 0) {
    return { ok: false, error: "already_has_owner" };
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(input.email, {
    data: { full_name: input.fullName },
    redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/auth/set-password`,
  });

  if (error || !data.user) {
    return { ok: false, error: "invite_failed", message: error?.message };
  }

  await db.insert(memberships).values({
    organizationId: input.organizationId,
    userId: data.user.id,
    role: "owner",
    status: "active",
    invitedBy: admin.userId,
  });

  await recordAuditLog({
    organizationId: input.organizationId,
    actorUserId: admin.userId,
    actorType: "platform_admin",
    action: "company.owner_invited",
    resourceType: "membership",
    resourceId: data.user.id,
    metadata: { email: input.email, role: "owner" },
  });

  return { ok: true };
}

/**
 * Company-side read of "my own organization" — the counterpart to the
 * platform-admin functions above. Goes through withRlsContext, not the
 * service-role `db`, and the organization id comes only from the verified
 * session (see CLAUDE.md §3.1) — never from a parameter a caller could pass.
 * This is the query the /app dashboard renders from, and the one exercised
 * by the cross-tenant isolation tests.
 */
export async function getMyOrganization(): Promise<Organization> {
  const session = await requireCompanySession();

  const org = await withRlsContext(session.userId, async (tx) => {
    const [row] = await tx
      .select()
      .from(organizations)
      .where(eq(organizations.id, session.organizationId))
      .limit(1);
    return row ?? null;
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  return org;
}

export type PlatformOverview = {
  totalCompanies: number;
  trialCompanies: number;
  activeCompanies: number;
  suspendedCompanies: number;
  totalCompanyUsers: number;
};

export async function getPlatformOverview(): Promise<PlatformOverview> {
  await requirePlatformAdmin();

  const [companyCounts, membershipCount] = await Promise.all([
    db
      .select({ status: organizations.status, total: count() })
      .from(organizations)
      .groupBy(organizations.status),
    db.select({ total: count() }).from(memberships),
  ]);

  const byStatus = Object.fromEntries(companyCounts.map((row) => [row.status, row.total]));

  return {
    totalCompanies: companyCounts.reduce((sum, row) => sum + row.total, 0),
    trialCompanies: byStatus.trial ?? 0,
    activeCompanies: byStatus.active ?? 0,
    suspendedCompanies: byStatus.suspended ?? 0,
    totalCompanyUsers: membershipCount[0]?.total ?? 0,
  };
}

export type PlatformUserRow = {
  membershipId: string;
  userId: string;
  organizationId: string;
  organizationName: string;
  role: string;
  status: string;
  createdAt: Date;
};

export async function listAllCompanyUsers(): Promise<PlatformUserRow[]> {
  await requirePlatformAdmin();

  return db
    .select({
      membershipId: memberships.id,
      userId: memberships.userId,
      organizationId: memberships.organizationId,
      organizationName: organizations.name,
      role: memberships.role,
      status: memberships.status,
      createdAt: memberships.createdAt,
    })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .orderBy(desc(memberships.createdAt));
}
