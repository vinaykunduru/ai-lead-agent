import { serve } from "inngest/next";
import { inngestClient } from "@/providers/jobs/client";
import { processDocumentFunction } from "@/modules/knowledge/jobs";

export const { GET, POST, PUT } = serve({
  client: inngestClient,
  functions: [processDocumentFunction],
});
