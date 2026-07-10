import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";

export default function LeadsPage() {
  return (
    <div>
      <PageHeader title="Leads" description="Leads captured from your website widget." />
      <div className="p-6">
        <EmptyState
          title="Leads aren't available yet"
          description="This module will be built in a later phase."
        />
      </div>
    </div>
  );
}
