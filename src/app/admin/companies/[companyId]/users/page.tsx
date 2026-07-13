import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listCompanyUsers } from "@/modules/organizations/service";
import { MembershipStatusBadge } from "@/shared/components/status-badge";
import { CreateFirstOwnerForm } from "./create-first-owner-form";

export default async function CompanyUsersPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const users = await listCompanyUsers(companyId);

  if (users.length === 0) {
    return <CreateFirstOwnerForm organizationId={companyId} />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Joined</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.membershipId}>
            <TableCell className="font-medium">{user.email ?? "—"}</TableCell>
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
  );
}
