import Link from "next/link";
import { PageHeader } from "@/shared/components/page-header";
import { requireCompanySession } from "@/lib/auth/session";
import { assertPermission } from "@/modules/permissions";
import { listCollections } from "@/modules/knowledge/collections-service";
import { SearchForm } from "./search-form";

export default async function KnowledgeSearchPage() {
  const session = await requireCompanySession();
  assertPermission(session, "knowledge.search");

  const collections = await listCollections();

  return (
    <div>
      <div className="border-b px-6 pt-5">
        <Link href="/app/knowledge-base" className="text-sm text-muted-foreground hover:underline">
          ← Knowledge Base
        </Link>
      </div>
      <PageHeader
        title="Search"
        description="Search only — results are the raw matching chunks, no AI-generated answer."
      />
      <div className="p-6">
        <SearchForm collections={collections.filter((c) => c.status === "active")} />
      </div>
    </div>
  );
}
