import { describe, expect, it } from "vitest";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  collectionIdSchema,
  createCollectionSchema,
  createTextDocumentSchema,
  createWebsiteDocumentSchema,
  documentIdSchema,
  renameCollectionSchema,
  semanticSearchSchema,
  updateDocumentSchema,
  uploadFileMetadataSchema,
} from "./validation";

const VALID_UUID = "123e4567-e89b-12d3-a456-426614174000";

describe("createCollectionSchema", () => {
  it("accepts a trimmed, non-empty name", () => {
    const result = createCollectionSchema.safeParse({ name: "  Support Docs  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe("Support Docs");
  });

  it("rejects an empty name", () => {
    expect(createCollectionSchema.safeParse({ name: "" }).success).toBe(false);
    expect(createCollectionSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects a name over 120 characters", () => {
    expect(createCollectionSchema.safeParse({ name: "x".repeat(121) }).success).toBe(false);
    expect(createCollectionSchema.safeParse({ name: "x".repeat(120) }).success).toBe(true);
  });
});

describe("renameCollectionSchema / collectionIdSchema", () => {
  it("requires a valid uuid for collectionId", () => {
    expect(collectionIdSchema.safeParse({ collectionId: VALID_UUID }).success).toBe(true);
    expect(collectionIdSchema.safeParse({ collectionId: "not-a-uuid" }).success).toBe(false);
  });

  it("requires both a valid collectionId and a non-empty name", () => {
    expect(
      renameCollectionSchema.safeParse({ collectionId: VALID_UUID, name: "Renamed" }).success,
    ).toBe(true);
    expect(renameCollectionSchema.safeParse({ collectionId: VALID_UUID, name: "" }).success).toBe(false);
  });
});

describe("createTextDocumentSchema", () => {
  const base = { collectionId: VALID_UUID, title: "FAQ", content: "Some content." };

  it("accepts a valid text document", () => {
    expect(createTextDocumentSchema.safeParse(base).success).toBe(true);
  });

  it("rejects an invalid collectionId", () => {
    expect(createTextDocumentSchema.safeParse({ ...base, collectionId: "nope" }).success).toBe(false);
  });

  it("rejects empty content and content over 200,000 characters", () => {
    expect(createTextDocumentSchema.safeParse({ ...base, content: "" }).success).toBe(false);
    expect(
      createTextDocumentSchema.safeParse({ ...base, content: "x".repeat(200_001) }).success,
    ).toBe(false);
    expect(
      createTextDocumentSchema.safeParse({ ...base, content: "x".repeat(200_000) }).success,
    ).toBe(true);
  });
});

describe("createWebsiteDocumentSchema", () => {
  it("accepts http and https URLs", () => {
    expect(
      createWebsiteDocumentSchema.safeParse({ collectionId: VALID_UUID, url: "https://example.com/about" })
        .success,
    ).toBe(true);
    expect(
      createWebsiteDocumentSchema.safeParse({ collectionId: VALID_UUID, url: "http://example.com" }).success,
    ).toBe(true);
  });

  it("rejects non-http(s) schemes", () => {
    expect(
      createWebsiteDocumentSchema.safeParse({ collectionId: VALID_UUID, url: "ftp://example.com/file" })
        .success,
    ).toBe(false);
    expect(
      createWebsiteDocumentSchema.safeParse({ collectionId: VALID_UUID, url: "javascript:alert(1)" })
        .success,
    ).toBe(false);
  });

  it("rejects strings that aren't valid URLs at all", () => {
    expect(
      createWebsiteDocumentSchema.safeParse({ collectionId: VALID_UUID, url: "not a url" }).success,
    ).toBe(false);
  });
});

describe("uploadFileMetadataSchema", () => {
  const base = {
    collectionId: VALID_UUID,
    title: "Handbook",
    fileName: "handbook.pdf",
    mimeType: "application/pdf" as const,
    fileSizeBytes: 1024,
  };

  it("accepts every allowlisted mime type", () => {
    for (const mimeType of Object.keys(ALLOWED_UPLOAD_MIME_TYPES)) {
      expect(uploadFileMetadataSchema.safeParse({ ...base, mimeType }).success).toBe(true);
    }
  });

  it("rejects a mime type outside the allowlist", () => {
    expect(
      uploadFileMetadataSchema.safeParse({ ...base, mimeType: "application/x-msdownload" }).success,
    ).toBe(false);
  });

  it("rejects a file size over the configured maximum", () => {
    expect(
      uploadFileMetadataSchema.safeParse({ ...base, fileSizeBytes: MAX_UPLOAD_FILE_SIZE_BYTES + 1 })
        .success,
    ).toBe(false);
    expect(
      uploadFileMetadataSchema.safeParse({ ...base, fileSizeBytes: MAX_UPLOAD_FILE_SIZE_BYTES }).success,
    ).toBe(true);
  });

  it("rejects a zero or negative file size", () => {
    expect(uploadFileMetadataSchema.safeParse({ ...base, fileSizeBytes: 0 }).success).toBe(false);
    expect(uploadFileMetadataSchema.safeParse({ ...base, fileSizeBytes: -1 }).success).toBe(false);
  });
});

describe("updateDocumentSchema / documentIdSchema", () => {
  it("requires a valid documentId", () => {
    expect(documentIdSchema.safeParse({ documentId: VALID_UUID }).success).toBe(true);
    expect(documentIdSchema.safeParse({ documentId: "nope" }).success).toBe(false);
  });

  it("allows title and collectionId to be omitted (partial update)", () => {
    expect(updateDocumentSchema.safeParse({ documentId: VALID_UUID }).success).toBe(true);
  });

  it("rejects an empty title when provided", () => {
    expect(updateDocumentSchema.safeParse({ documentId: VALID_UUID, title: "" }).success).toBe(false);
  });
});

describe("semanticSearchSchema", () => {
  it("accepts a minimal valid query", () => {
    expect(semanticSearchSchema.safeParse({ query: "refund policy" }).success).toBe(true);
  });

  it("rejects an empty query", () => {
    expect(semanticSearchSchema.safeParse({ query: "" }).success).toBe(false);
    expect(semanticSearchSchema.safeParse({ query: "   " }).success).toBe(false);
  });

  it("rejects a query over 1000 characters", () => {
    expect(semanticSearchSchema.safeParse({ query: "x".repeat(1001) }).success).toBe(false);
  });

  it("enforces limit bounds between 1 and 50", () => {
    expect(semanticSearchSchema.safeParse({ query: "q", limit: 0 }).success).toBe(false);
    expect(semanticSearchSchema.safeParse({ query: "q", limit: 51 }).success).toBe(false);
    expect(semanticSearchSchema.safeParse({ query: "q", limit: 1 }).success).toBe(true);
    expect(semanticSearchSchema.safeParse({ query: "q", limit: 50 }).success).toBe(true);
  });

  it("rejects an invalid collectionId when provided", () => {
    expect(semanticSearchSchema.safeParse({ query: "q", collectionId: "nope" }).success).toBe(false);
  });
});
