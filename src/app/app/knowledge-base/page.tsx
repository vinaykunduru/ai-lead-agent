import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";

export default function KnowledgeBasePage() {
  return (
    <div>
      <PageHeader title="Knowledge Base" description="Train your AI agent on your business." />
      <div className="p-6">
        <EmptyState
          title="Knowledge Base isn't available yet"
          description="This module will be built in a later phase."
        />
      </div>
    </div>
  );
}
