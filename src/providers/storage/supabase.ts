import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { StorageProvider } from "./types";

/**
 * Private bucket — never made public. All access goes through the
 * service-role client (upload/delete during processing) or short-lived
 * signed URLs (any client-facing download need), never a direct public
 * path. See CLAUDE.md §6 ("no sensitive data leakage") and the module spec
 * ("Never expose storage directly").
 */
export const KNOWLEDGE_DOCUMENTS_BUCKET = "knowledge-documents";

class SupabaseStorageProvider implements StorageProvider {
  async upload(path: string, file: Buffer, contentType: string): Promise<void> {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.storage
      .from(KNOWLEDGE_DOCUMENTS_BUCKET)
      .upload(path, file, { contentType, upsert: false });
    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }
  }

  async download(path: string): Promise<Buffer> {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage.from(KNOWLEDGE_DOCUMENTS_BUCKET).download(path);
    if (error || !data) {
      throw new Error(`Storage download failed: ${error?.message ?? "no data"}`);
    }
    return Buffer.from(await data.arrayBuffer());
  }

  async getSignedDownloadUrl(path: string, expiresInSeconds = 300): Promise<string> {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from(KNOWLEDGE_DOCUMENTS_BUCKET)
      .createSignedUrl(path, expiresInSeconds);
    if (error || !data) {
      throw new Error(`Failed to create signed URL: ${error?.message ?? "no data"}`);
    }
    return data.signedUrl;
  }

  async delete(path: string): Promise<void> {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.storage.from(KNOWLEDGE_DOCUMENTS_BUCKET).remove([path]);
    if (error) {
      throw new Error(`Storage delete failed: ${error.message}`);
    }
  }
}

/**
 * The only storage implementation business modules should import — see
 * CLAUDE.md §2.
 */
export const storageProvider: StorageProvider = new SupabaseStorageProvider();
