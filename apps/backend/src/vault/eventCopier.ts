import {
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  HeadObjectCommand,
  S3Client,
  UploadPartCopyCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import type { VaultCopySettings } from "./config.js";

/** Copies an event original into the Vault bucket. Runs inside Backblaze: nothing streams through our server. */
export interface EventToVaultCopier {
  /** Size of the event original, or null if it no longer exists. */
  getEventObjectSize(eventKey: string): Promise<number | null>;
  copyToVault(eventKey: string, vaultKey: string, sizeBytes: number, mimeType: string): Promise<void>;
}

// S3 CopyObject handles up to 5 GB; larger files are copied in 1 GB parts with UploadPartCopy.
const SINGLE_COPY_LIMIT = 5 * 1024 * 1024 * 1024;
const COPY_PART_BYTES = 1024 * 1024 * 1024;

export function createS3EventToVaultCopier(settings: VaultCopySettings): EventToVaultCopier {
  const client = new S3Client({
    endpoint: settings.endpoint,
    region: settings.region,
    credentials: { accessKeyId: settings.keyId, secretAccessKey: settings.applicationKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const copySource = (key: string) => `${settings.eventBucket}/${encodeURIComponent(key).replace(/%2F/g, "/")}`;

  return {
    async getEventObjectSize(eventKey) {
      try {
        const head = await client.send(new HeadObjectCommand({ Bucket: settings.eventBucket, Key: eventKey }));
        return typeof head.ContentLength === "number" ? head.ContentLength : null;
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
        if (status === 404) return null;
        throw error;
      }
    },

    async copyToVault(eventKey, vaultKey, sizeBytes, mimeType) {
      if (sizeBytes <= SINGLE_COPY_LIMIT) {
        await client.send(new CopyObjectCommand({
          Bucket: settings.vaultBucket,
          Key: vaultKey,
          CopySource: copySource(eventKey),
          MetadataDirective: "REPLACE",
          ContentType: mimeType,
        }));
        return;
      }

      const created = await client.send(new CreateMultipartUploadCommand({ Bucket: settings.vaultBucket, Key: vaultKey, ContentType: mimeType }));
      const uploadId = created.UploadId;
      if (!uploadId) throw new Error("Storage did not return a multipart upload id");
      try {
        const parts: { PartNumber: number; ETag: string }[] = [];
        for (let start = 0, partNumber = 1; start < sizeBytes; start += COPY_PART_BYTES, partNumber += 1) {
          const end = Math.min(start + COPY_PART_BYTES, sizeBytes) - 1;
          const result = await client.send(new UploadPartCopyCommand({
            Bucket: settings.vaultBucket,
            Key: vaultKey,
            UploadId: uploadId,
            PartNumber: partNumber,
            CopySource: copySource(eventKey),
            CopySourceRange: `bytes=${start}-${end}`,
          }));
          const etag = result.CopyPartResult?.ETag;
          if (!etag) throw new Error(`Storage did not confirm copy part ${partNumber}`);
          parts.push({ PartNumber: partNumber, ETag: etag });
        }
        await client.send(new CompleteMultipartUploadCommand({
          Bucket: settings.vaultBucket, Key: vaultKey, UploadId: uploadId, MultipartUpload: { Parts: parts },
        }));
      } catch (error) {
        await client.send(new AbortMultipartUploadCommand({ Bucket: settings.vaultBucket, Key: vaultKey, UploadId: uploadId })).catch(() => null);
        throw error;
      }
    },
  };
}
