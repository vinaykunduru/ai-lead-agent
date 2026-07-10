import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";

export default function CompanySettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Company profile and preferences." />
      <div className="p-6">
        <EmptyState
          title="Settings aren't available yet"
          description="This module will be built in a later phase."
        />
      </div>
    </div>
  );
}
