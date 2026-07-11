import { z } from "zod";

export const ALLOWED_UPLOAD_MIME_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
} as const;

export const ALLOWED_UPLOAD_EXTENSIONS = [".pdf", ".docx"] as const;

export const MAX_UPLOAD_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export const createCollectionSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
});
export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;

export const renameCollectionSchema = z.object({
  collectionId: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required").max(120),
});
export type RenameCollectionInput = z.infer<typeof renameCollectionSchema>;

export const collectionIdSchema = z.object({
  collectionId: z.string().uuid(),
});
export type CollectionIdInput = z.infer<typeof collectionIdSchema>;

export const createTextDocumentSchema = z.object({
  collectionId: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required").max(200),
  content: z.string().trim().min(1, "Content is required").max(200_000),
});
export type CreateTextDocumentInput = z.infer<typeof createTextDocumentSchema>;

export const createWebsiteDocumentSchema = z.object({
  collectionId: z.string().uuid(),
  url: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .refine((value) => value.startsWith("https://") || value.startsWith("http://"), {
      message: "URL must start with http:// or https://",
    }),
});
export type CreateWebsiteDocumentInput = z.infer<typeof createWebsiteDocumentSchema>;

export const uploadFileMetadataSchema = z.object({
  collectionId: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required").max(200),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]),
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_FILE_SIZE_BYTES, "File is too large (max 20MB)"),
});
export type UploadFileMetadataInput = z.infer<typeof uploadFileMetadataSchema>;

export const updateDocumentSchema = z.object({
  documentId: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
  collectionId: z.string().uuid().optional(),
});
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export const documentIdSchema = z.object({
  documentId: z.string().uuid(),
});
export type DocumentIdInput = z.infer<typeof documentIdSchema>;

export const semanticSearchSchema = z.object({
  query: z.string().trim().min(1, "Enter a search query").max(1000),
  collectionId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});
export type SemanticSearchInput = z.infer<typeof semanticSearchSchema>;
