import Link from "next/link";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAllCompanyUsers } from "@/modules/organizations/service";
import { MembershipStatusBadge } from "@/shared/components/status-badge";

export default async function PlatformUsersPage() {
  const users = await listAllCompanyUsers();

  return (
    <div>
      <PageHeader title="Users" description="Every company user across the platform." />
      <div className="p-6">
        {users.length === 0 ? (
          <EmptyState title="No company users yet" />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.membershipId}>
                    <TableCell>
                      <Link
                        href={`/admin/companies/${user.organizationId}`}
                        className="font-medium hover:underline"
                      >
                        {user.organizationName}
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize">{user.role}</TableCell>
                    <TableCell>
                      <MembershipStatusBadge status={user.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.createdAt.toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
