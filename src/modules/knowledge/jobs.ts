import { inngestClient } from "@/providers/jobs/client";
import { DOCUMENT_PROCESS_EVENT } from "./documents-service";
import { processDocument } from "./processing-service";

/**
 * Registered with Inngest via src/app/api/inngest/route.ts. Thin glue only
 * — the real logic lives in processDocument(), which stays a plain,
 * directly-callable/testable function (see its own comment for why).
 */
export const processDocumentFunction = inngestClient.createFunction(
  { id: "knowledge-process-document", retries: 2, triggers: { event: DOCUMENT_PROCESS_EVENT } },
  async ({ event }) => {
    const documentId = event.data.documentId as string;
    await processDocument(documentId);
  },
);
