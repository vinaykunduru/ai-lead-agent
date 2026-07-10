import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";

export default function PlatformSettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Platform-level configuration." />
      <div className="p-6">
        <EmptyState
          title="Platform settings aren't available yet"
          description="This section will be built out in a later phase."
        />
      </div>
    </div>
  );
}
