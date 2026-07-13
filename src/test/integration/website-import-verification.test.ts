import { readFileSync } from "fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/** A minimal, real, spec-compliant single-page PDF ("Hello PDF World") built
 * inline so this test has no dependency on an external fixture file. */
function buildMinimalPdf(text: string): Buffer {
  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 300 144] /Contents 5 0 R >>\nendobj\n",
  );
  objects.push("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
  const stream = `BT /F1 24 Tf 20 100 Td (${text}) Tj ET`;
  objects.push(`5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += obj;
  }
  const xrefStart = Buffer.byteLength(pdf, "latin1");
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += xref;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

/**
 * Regression test for the website-import extraction incident: jsdom's
 * dependency tree repeatedly and unpredictably reintroduced ESM-only
 * sub-dependencies (@exodus/bytes via html-encoding-sniffer, then again via
 * whatwg-url, then again via cssstyle -> @asamuzakjp/css-color ->
 * @csstools/css-calc), each crashing /api/inngest with ERR_REQUIRE_ESM in
 * production across three separate, independent occurrences. Fixed by
 * replacing jsdom with linkedom (see modules/knowledge/extraction/website.ts
 * and README.md's "Known dependency pins"), which has a minimal, stable
 * dependency tree with no such history.
 *
 * The website-import test below deliberately fetches a real page with actual
 * CSS content (not a bare-bones synthetic fixture) — an earlier, narrower
 * version of this test never exercised jsdom's CSS-parsing code path, which
 * is exactly the path that caused the third occurrence to go undetected
 * until production. Exercises the exact real pipeline that was broken:
 * website import -> extraction -> chunking -> real Voyage embeddings ->
 * pgvector storage -> semantic retrieval -> a real AI provider call ->
 * citation recording. No mocks anywhere in this path — per CLAUDE.md's
 * standing rule, this only runs against a real Supabase project with real
 * provider credentials, and skips cleanly otherwise.
 */

const hasLiveEnv = Boolean(
  process.env.DATABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_APP_URL &&
    process.env.VOYAGE_API_KEY &&
    process.env.OPENAI_API_KEY,
);

describe.skipIf(!hasLiveEnv)("website import fix (linkedom) — real end-to-end pipeline", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mod: any;
  let org: { id: string };
  let user: { id: string };
  let collection: { id: string };
  let widget: { id: string };
  let session: { id: string };
  let conversation: { id: string };
  let websiteDocumentId: string;
  let pdfDocumentId: string;
  let docxDocumentId: string;

  beforeAll(async () => {
    const [dbClient, schema, supabaseAdmin, drizzleOrm, processingService, searchService, citations, aiProviders] =
      await Promise.all([
        import("@/db/client"),
        import("@/db/schema"),
        import("@/lib/supabase/admin"),
        import("drizzle-orm"),
        import("@/modules/knowledge/processing-service"),
        import("@/modules/knowledge/search-service"),
        import("@/modules/conversation/citations"),
        import("@/providers/ai"),
      ]);
    mod = {
      db: dbClient.db,
      schema,
      admin: supabaseAdmin.createSupabaseAdminClient(),
      eq: drizzleOrm.eq,
      processDocument: processingService.processDocument,
      retrieveKnowledgeForConversation: searchService.retrieveKnowledgeForConversation,
      recordCitations: citations.recordCitations,
      getAiProvider: aiProviders.getAiProvider,
    };

    const stamp = Date.now();
    const { data: userData } = await mod.admin.auth.admin.createUser({
      email: `website-import-test-${stamp}@example.com`,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    user = { id: userData.user.id };

    const [orgRow] = await mod.db
      .insert(mod.schema.organizations)
      .values({ name: "Website Import Test Org", slug: `website-import-test-${stamp}` })
      .returning();
    org = { id: orgRow.id };

    await mod.db
      .insert(mod.schema.memberships)
      .values({ organizationId: org.id, userId: user.id, role: "owner", status: "active" });

    const [collectionRow] = await mod.db
      .insert(mod.schema.knowledgeCollections)
      .values({ organizationId: org.id, name: "General", isDefault: true, createdBy: user.id })
      .returning();
    collection = { id: collectionRow.id };

    const [widgetRow] = await mod.db
      .insert(mod.schema.widgets)
      .values({ organizationId: org.id, name: "Test Widget", status: "active", createdBy: user.id })
      .returning();
    widget = { id: widgetRow.id };

    const [sessionRow] = await mod.db
      .insert(mod.schema.conversationSessions)
      .values({ organizationId: org.id, widgetId: widget.id, visitorId: `visitor-${stamp}` })
      .returning();
    session = { id: sessionRow.id };

    const [conversationRow] = await mod.db
      .insert(mod.schema.conversations)
      .values({ organizationId: org.id, widgetId: widget.id, sessionId: session.id })
      .returning();
    conversation = { id: conversationRow.id };
  }, 30_000);

  /**
   * The Voyage account used for local/CI verification has no payment method
   * on file, capping it at 3 requests/minute — an account-billing
   * constraint, not a defect in the code under test. When running alongside
   * the rest of the suite, call timing shifts enough that a 429 can land on
   * any of this file's several real embedding calls, not always the same
   * one. Retrying with backoff keeps this test asserting real, non-mocked
   * behavior while not being flaky against that external rate limit.
   */
  async function processDocumentWithRetry(documentId: string, maxAttempts = 4): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await mod.processDocument(documentId);
      const [result] = await mod.db
        .select()
        .from(mod.schema.knowledgeDocuments)
        .where(mod.eq(mod.schema.knowledgeDocuments.id, documentId));
      if (result.status !== "failed") return;
      const rateLimited = /429|rate limit/i.test(result.errorMessage ?? "");
      if (!rateLimited || attempt === maxAttempts) return;
      await new Promise((resolve) => setTimeout(resolve, 25_000));
    }
  }

  async function retrieveWithRetry(
    query: string,
    maxAttempts = 4,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any[]> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await mod.retrieveKnowledgeForConversation(org.id, query);
      } catch (error) {
        const rateLimited = error instanceof Error && /429|rate limit/i.test(error.message);
        if (!rateLimited || attempt === maxAttempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, 25_000));
      }
    }
    return [];
  }

  afterAll(async () => {
    if (org?.id) {
      await mod.db.delete(mod.schema.organizations).where(mod.eq(mod.schema.organizations.id, org.id));
    }
    if (user?.id) {
      await mod.admin.auth.admin.deleteUser(user.id);
    }
  });

  it(
    "processes a REAL website import end-to-end: fetch (real CSS content) -> linkedom/Readability -> chunk -> real Voyage embeddings -> ready",
    async () => {
      const [doc] = await mod.db
        .insert(mod.schema.knowledgeDocuments)
        .values({
          organizationId: org.id,
          collectionId: collection.id,
          type: "website",
          title: "https://bloomdigital.co.in/services",
          sourceUrl: "https://bloomdigital.co.in/services",
          uploadedBy: user.id,
        })
        .returning();
      websiteDocumentId = doc.id;

      await processDocumentWithRetry(websiteDocumentId);

      const [result] = await mod.db
        .select()
        .from(mod.schema.knowledgeDocuments)
        .where(mod.eq(mod.schema.knowledgeDocuments.id, websiteDocumentId));

      expect(result.status, `errorMessage: ${result.errorMessage}`).toBe("ready");
      expect(result.embeddingStatus).toBe("ready");
      expect(result.errorMessage).toBeNull();
      expect(result.chunkCount).toBeGreaterThan(0);
      expect(result.tokenCount).toBeGreaterThan(0);

      const chunks = await mod.db
        .select()
        .from(mod.schema.knowledgeChunks)
        .where(mod.eq(mod.schema.knowledgeChunks.documentId, websiteDocumentId));
      expect(chunks.length).toBe(result.chunkCount);
      expect(chunks[0].embedding).toBeTruthy();
      expect(chunks[0].embedding.length).toBeGreaterThan(0);
    },
    150_000,
  );

  it(
    "processes a REAL PDF upload end-to-end (unaffected code path — confirms no regression)",
    async () => {
      const { storageProvider } = await import("@/providers/storage");
      const pdfBuffer = buildMinimalPdf("Hello PDF World");
      const storagePath = `${org.id}/test-${Date.now()}.pdf`;
      await storageProvider.upload(storagePath, pdfBuffer, "application/pdf");

      const [doc] = await mod.db
        .insert(mod.schema.knowledgeDocuments)
        .values({
          organizationId: org.id,
          collectionId: collection.id,
          type: "pdf",
          title: "test.pdf",
          storagePath,
          uploadedBy: user.id,
        })
        .returning();
      pdfDocumentId = doc.id;

      await processDocumentWithRetry(pdfDocumentId);

      const [result] = await mod.db
        .select()
        .from(mod.schema.knowledgeDocuments)
        .where(mod.eq(mod.schema.knowledgeDocuments.id, pdfDocumentId));

      expect(result.status, `errorMessage: ${result.errorMessage}`).toBe("ready");
      expect(result.chunkCount).toBeGreaterThan(0);

      await storageProvider.delete(storagePath);
    },
    150_000,
  );

  it(
    "processes a REAL DOCX upload end-to-end (unaffected code path — confirms no regression)",
    async () => {
      const { storageProvider } = await import("@/providers/storage");
      const docxBuffer = readFileSync(
        "node_modules/.pnpm/mammoth@1.12.0/node_modules/mammoth/test/test-data/single-paragraph.docx",
      );
      const storagePath = `${org.id}/test-${Date.now()}.docx`;
      await storageProvider.upload(
        storagePath,
        docxBuffer,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );

      const [doc] = await mod.db
        .insert(mod.schema.knowledgeDocuments)
        .values({
          organizationId: org.id,
          collectionId: collection.id,
          type: "docx",
          title: "test.docx",
          storagePath,
          uploadedBy: user.id,
        })
        .returning();
      docxDocumentId = doc.id;

      await processDocumentWithRetry(docxDocumentId);

      const [result] = await mod.db
        .select()
        .from(mod.schema.knowledgeDocuments)
        .where(mod.eq(mod.schema.knowledgeDocuments.id, docxDocumentId));

      expect(result.status, `errorMessage: ${result.errorMessage}`).toBe("ready");
      expect(result.chunkCount).toBeGreaterThan(0);

      await storageProvider.delete(storagePath);
    },
    150_000,
  );

  // Shared across the next two tests so only ONE more Voyage embeddings call
  // is needed beyond the three already made by the processing tests above —
  // the test account has no payment method on file, capping it at 3
  // requests/minute (an account-billing constraint, unrelated to this fix).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let sharedRetrievedChunks: any[];

  it(
    "real semantic retrieval finds the embedded website content for a relevant query",
    async () => {
      sharedRetrievedChunks = await retrieveWithRetry("What does Bloom Digital do?");
      expect(sharedRetrievedChunks.length).toBeGreaterThan(0);
      expect(sharedRetrievedChunks[0].similarity).toBeGreaterThan(0);
      expect(sharedRetrievedChunks[0].content.length).toBeGreaterThan(0);
    },
    120_000,
  );

  it(
    "a real AI provider call generates a grounded response using the retrieved chunks, and citations are recorded",
    async () => {
      const retrievedChunks = sharedRetrievedChunks;
      expect(retrievedChunks.length).toBeGreaterThan(0);

      const provider = mod.getAiProvider("openai");
      const systemPrompt = `You are a helpful assistant. Answer ONLY using this context:\n\n${retrievedChunks
        .map((c: { content: string }) => c.content)
        .join("\n\n")}`;

      let accumulated = "";
      const controller = new AbortController();
      for await (const event of provider.streamChat({
        systemPrompt,
        messages: [{ role: "user", content: "What does this company do? Answer in one sentence." }],
        signal: controller.signal,
      })) {
        if (event.type === "token") accumulated += event.text;
        if (event.type === "error") throw new Error(`AI provider error: ${event.message}`);
      }
      expect(accumulated.trim().length).toBeGreaterThan(0);

      const [message] = await mod.db
        .insert(mod.schema.conversationMessages)
        .values({
          organizationId: org.id,
          conversationId: conversation.id,
          role: "assistant",
          content: accumulated,
          status: "complete",
          provider: provider.id,
          model: provider.model,
        })
        .returning();

      await mod.recordCitations(org.id, conversation.id, message.id, retrievedChunks);

      const citationRows = await mod.db
        .select()
        .from(mod.schema.conversationCitations)
        .where(mod.eq(mod.schema.conversationCitations.messageId, message.id));

      expect(citationRows.length).toBe(Math.min(retrievedChunks.length, retrievedChunks.length));
      expect(citationRows[0].chunkId).toBeTruthy();
      expect(citationRows[0].similarity).toBeGreaterThan(0);
    },
    60_000,
  );
});
