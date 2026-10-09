import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { vaultConfig, type VaultBucketSettings } from "./config.js";

/**
 * Everything Vault needs from object storage. Every signed URL is bound to one object key (and for
 * uploads, its exact size), so a browser can never use it to read or write any other file.
 */
export interface VaultStorage {
  readonly bucket: string;
  signSingleUpload(key: string, sizeBytes: number, mimeType: string): Promise<string>;
  startMultipartUpload(key: string, mimeType: string): Promise<string>;
  signUploadPart(key: string, multipartUploadId: string, partNumber: number): Promise<string>;
  completeMultipartUpload(key: string, multipartUploadId: string, parts: { partNumber: number; etag: string }[]): Promise<void>;
  abortMultipartUpload(key: string, multipartUploadId: string): Promise<void>;
  /** Size of the stored object, or null if it does not exist. */
  getObjectSize(key: string): Promise<number | null>;
  deleteObject(key: string): Promise<void>;
  signDownload(key: string, options: { contentDisposition: string; contentType: string }): Promise<string>;
}

export function createS3VaultStorage(settings: VaultBucketSettings): VaultStorage {
  const client = new S3Client({
    endpoint: settings.endpoint,
    region: settings.region,
    credentials: { accessKeyId: settings.keyId, secretAccessKey: settings.applicationKey },
    // Checksum headers the browser would have to replicate break presigned uploads to B2.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const Bucket = settings.bucket;
  const uploadTtl = { expiresIn: vaultConfig.uploadLinkTtlSeconds };

  return {
    bucket: Bucket,

    signSingleUpload: (Key, sizeBytes, ContentType) =>
      getSignedUrl(client, new PutObjectCommand({ Bucket, Key, ContentType, ContentLength: sizeBytes }), {
        ...uploadTtl,
        signableHeaders: new Set(["content-type", "content-length"]),
      }),

    async startMultipartUpload(Key, ContentType) {
      const result = await client.send(new CreateMultipartUploadCommand({ Bucket, Key, ContentType }));
      if (!result.UploadId) throw new Error("Storage did not return a multipart upload id");
      return result.UploadId;
    },

    signUploadPart: (Key, UploadId, PartNumber) =>
      getSignedUrl(client, new UploadPartCommand({ Bucket, Key, UploadId, PartNumber }), uploadTtl),

    async completeMultipartUpload(Key, UploadId, parts) {
      await client.send(new CompleteMultipartUploadCommand({
        Bucket,
        Key,
        UploadId,
        MultipartUpload: { Parts: parts.map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })) },
      }));
    },

    async abortMultipartUpload(Key, UploadId) {
      await client.send(new AbortMultipartUploadCommand({ Bucket, Key, UploadId }));
    },

    async getObjectSize(Key) {
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket, Key }));
        return typeof head.ContentLength === "number" ? head.ContentLength : null;
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status === 404) return null;
        throw error;
      }
    },

    async deleteObject(Key) {
      await client.send(new DeleteObjectCommand({ Bucket, Key }));
    },

    signDownload: (Key, { contentDisposition, contentType }) =>
      getSignedUrl(client, new GetObjectCommand({
        Bucket,
        Key,
        ResponseContentDisposition: contentDisposition,
        ResponseContentType: contentType,
        ResponseCacheControl: "private, no-store",
      }), { expiresIn: vaultConfig.downloadLinkTtlSeconds }),
  };
}
