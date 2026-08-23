import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageProvider } from "@/lib/storage";

/**
 * S3-compatible provider (AWS S3 / Wasabi / DO Spaces).
 * Active when S3_ENDPOINT + S3_ACCESS_KEY + S3_SECRET_KEY + S3_BUCKET are set.
 */
export class S3Provider implements StorageProvider {
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor() {
    this.bucket = String(process.env.S3_BUCKET ?? "");
    this.client = new S3Client({
      endpoint: process.env.S3_ENDPOINT || undefined,
      region: process.env.S3_REGION || "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: String(process.env.S3_ACCESS_KEY ?? ""),
        secretAccessKey: String(process.env.S3_SECRET_KEY ?? ""),
      },
    });
  }

  async upload(buffer: Buffer, key: string, contentType: string): Promise<string> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    // S3 path-style public URL; objects are private by default, so consumers
    // should call getSignedUrl for downloads.
    return `s3://${this.bucket}/${key}`;
  }

  async getSignedUrl(key: string, expirySeconds = 900): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expirySeconds }
    );
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
  }
}