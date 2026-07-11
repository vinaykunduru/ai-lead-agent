import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/shared/components/page-header";
import { requireCompanySession } from "@/lib/auth/session";
import { can } from "@/modules/permissions";
import { listCollections } from "@/modules/knowledge/collections-service";
import { listDocuments } from "@/modules/knowledge/documents-service";
import { CollectionsSidebar } from "./collections-sidebar";
import { DocumentsTable } from "./documents-table";

export default async function KnowledgeBasePage({
  searchParams,
}: {
  searchParams: Promise<{ collectionId?: string }>;
}) {
  const { collectionId } = await searchParams;
  const session = await requireCompanySession();

  const [collections, documents] = await Promise.all([
    listCollections(),
    listDocuments({ collectionId }),
  ]);

  const permissions = {
    canCreate: can(session, "knowledge.create"),
    canUpdate: can(session, "knowledge.update"),
    canDelete: can(session, "knowledge.delete"),
    canReprocess: can(session, "knowledge.reprocess"),
  };

  return (
    <div>
      <PageHeader
        title="Knowledge Base"
        description="Train your AI agent on your business."
        actions={
          <Button variant="outline" render={<Link href="/app/knowledge-base/search">Search</Link>} />
        }
      />
      <div className="flex flex-col gap-6 p-6 md:flex-row">
        <CollectionsSidebar
          collections={collections}
          activeCollectionId={collectionId}
          canCreate={permissions.canCreate}
          canUpdate={permissions.canUpdate}
          canDelete={permissions.canDelete}
        />
        <div className="flex-1 min-w-0">
          <DocumentsTable
            documents={documents}
            collections={collections}
            activeCollectionId={collectionId}
            canCreate={permissions.canCreate}
            canUpdate={permissions.canUpdate}
            canDelete={permissions.canDelete}
            canReprocess={permissions.canReprocess}
          />
        </div>
      </div>
    </div>
  );
}
