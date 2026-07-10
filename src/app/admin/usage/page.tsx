import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";

export default function PlatformUsagePage() {
  return (
    <div>
      <PageHeader title="Usage" description="Platform-wide usage summary." />
      <div className="p-6">
        <EmptyState
          title="Usage tracking isn't available yet"
          description="This will populate once the conversations and billing modules are built in a later phase."
        />
      </div>
    </div>
  );
}
