export interface StorageProvider {
  upload(path: string, file: Buffer, contentType: string): Promise<void>;
  download(path: string): Promise<Buffer>;
  getSignedDownloadUrl(path: string, expiresInSeconds?: number): Promise<string>;
  delete(path: string): Promise<void>;
}
