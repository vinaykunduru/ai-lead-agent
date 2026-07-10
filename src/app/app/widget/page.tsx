import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";

export default function WidgetSettingsPage() {
  return (
    <div>
      <PageHeader title="Widget" description="Customize and embed your website AI widget." />
      <div className="p-6">
        <EmptyState
          title="Widget settings aren't available yet"
          description="This module will be built in a later phase."
        />
      </div>
    </div>
  );
}
