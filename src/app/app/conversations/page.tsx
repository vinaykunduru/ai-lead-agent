import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";

export default function ConversationsPage() {
  return (
    <div>
      <PageHeader title="Conversations" description="AI and visitor conversations." />
      <div className="p-6">
        <EmptyState
          title="Conversations aren't available yet"
          description="This module will be built in a later phase."
        />
      </div>
    </div>
  );
}
