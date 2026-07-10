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
import { listAuditLogs } from "@/modules/audit/service";

export default async function PlatformAuditLogsPage() {
  const logs = await listAuditLogs();

  return (
    <div>
      <PageHeader title="Audit Logs" description="Platform-wide activity, most recent first." />
      <div className="p-6">
        {logs.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
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
                  <TableCell className="capitalize text-muted-foreground">
                    {log.actorType}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {log.createdAt.toLocaleString()}
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
