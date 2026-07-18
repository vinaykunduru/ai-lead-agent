import { EmptyState } from "@/shared/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAuditLogs } from "@/modules/audit/service";

export default async function CompanyAuditLogsPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const logs = await listAuditLogs({ organizationId: companyId });

  if (logs.length === 0) {
    return <EmptyState title="No activity yet" description="Actions taken on this company will appear here." />;
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead>Resource</TableHead>
            <TableHead>Actor type</TableHead>
            <TableHead>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell className="font-medium">{log.action}</TableCell>
              <TableCell className="text-muted-foreground">
                {log.resourceType}
                {log.resourceId ? ` · ${log.resourceId.slice(0, 8)}` : ""}
              </TableCell>
              <TableCell className="capitalize text-muted-foreground">{log.actorType}</TableCell>
              <TableCell className="text-muted-foreground">
                {log.createdAt.toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
