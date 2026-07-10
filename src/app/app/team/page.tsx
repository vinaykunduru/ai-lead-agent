import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";

export default function TeamPage() {
  return (
    <div>
      <PageHeader title="Team" description="Manage who has access to this workspace." />
      <div className="p-6">
        <EmptyState
          title="Team management isn't available yet"
          description="This module will be built in a later phase."
        />
      </div>
    </div>
  );
}
