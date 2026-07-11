import { PageHeader } from "@/shared/components/page-header";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { AnalyticsNav } from "./analytics-nav";

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireCompanySession();
  assertPermission(session, "analytics.view");

  return (
    <div>
      <PageHeader title="Analytics" description="Business intelligence across conversations, leads, and AI performance." />
      <AnalyticsNav />
      {children}
    </div>
  );
}
