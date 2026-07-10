import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";

export default function AiBehaviourPage() {
  return (
    <div>
      <PageHeader title="AI Behaviour" description="Configure how your AI agent responds." />
      <div className="p-6">
        <EmptyState
          title="AI Behaviour isn't available yet"
          description="This module will be built in a later phase."
        />
      </div>
    </div>
  );
}
