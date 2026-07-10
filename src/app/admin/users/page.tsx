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
import { Badge } from "@/components/ui/badge";
import { listAllCompanyUsers } from "@/modules/organizations/service";

export default async function PlatformUsersPage() {
  const users = await listAllCompanyUsers();

  return (
    <div>
      <PageHeader title="Users" description="Every company user across the platform." />
      <div className="p-6">
        {users.length === 0 ? (
          <EmptyState title="No company users yet" />
        ) : (
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
                    <Badge variant="secondary" className="capitalize">
                      {user.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.createdAt.toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
