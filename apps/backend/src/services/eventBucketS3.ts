import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getCachedBackblazeAuth } from "../backblaze.js";

/**
 * The event bucket (originals + hls/ streaming copies) through B2's S3-compatible API, for todo #18: links signed
 * for ONE object each, so a RunPod worker can download one original and upload one video's streaming files
 * without ever holding a key. Uses the backend's existing B2_KEY_ID / B2_APPLICATION_KEY; the endpoint comes from
 * B2_S3_ENDPOINT (or B2_ENDPOINT) or else from the account's login, the bucket from B2_BUCKET_NAME.
 */
export interface EventBucket {
  bucket: string;
  signDownload(key: string, expiresInSeconds: number): Promise<string>;
  signUpload(key: string, contentType: string, cacheControl: string, expiresInSeconds: number): Promise<string>;
  /** Every object (latest versions) under the prefix with its size. */
  list(prefix: string): Promise<{ key: string; size: number }[]>;
  /** Every stored version and delete marker under the prefix. */
  listVersions(prefix: string): Promise<{ key: string; versionId: string; isLatest: boolean }[]>;
  deleteVersions(items: { key: string; versionId: string }[]): Promise<number>;
}

function endpointHost(raw: string) {
  return raw.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

let cached: Promise<EventBucket | null> | null = null;

export function getEventBucket(env: NodeJS.ProcessEnv = process.env): Promise<EventBucket | null> {
  if (!cached) {
    cached = createEventBucket(env).catch((err) => {
      cached = null;
      throw err;
    });
  }
  return cached;
}

export async function createEventBucket(env: NodeJS.ProcessEnv = process.env): Promise<EventBucket | null> {
  const bucket = env.B2_BUCKET_NAME?.trim();
  const keyId = env.B2_KEY_ID?.trim();
  const applicationKey = env.B2_APPLICATION_KEY?.trim();
  if (!bucket || !keyId || !applicationKey) return null;
  const configured = (env.B2_S3_ENDPOINT || env.B2_ENDPOINT || "").trim();
  const host = endpointHost(configured || (await getCachedBackblazeAuth()).s3ApiUrl || "");
  if (!host) return null;
  const region = host.split(".")[1] || "us-east-005";

  const client = new S3Client({
    endpoint: `https://${host}`,
    region,
    forcePathStyle: true,
    credentials: { accessKeyId: keyId, secretAccessKey: applicationKey },
    // Checksum headers a worker would have to replicate break presigned uploads to B2 (as in vault/storage.ts)
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  const Bucket = bucket;

  return {
    bucket,
    signDownload: (Key, expiresIn) => getSignedUrl(client, new GetObjectCommand({ Bucket, Key }), { expiresIn }),
    signUpload: (Key, ContentType, CacheControl, expiresIn) =>
      getSignedUrl(client, new PutObjectCommand({ Bucket, Key, ContentType, CacheControl }), {
        expiresIn,
        signableHeaders: new Set(["content-type", "cache-control"]),
      }),
    async list(Prefix) {
      const out: { key: string; size: number }[] = [];
      let ContinuationToken: string | undefined;
      do {
        const page = await client.send(new ListObjectsV2Command({ Bucket, Prefix, ContinuationToken }));
        for (const item of page.Contents || []) if (item.Key) out.push({ key: item.Key, size: Number(item.Size || 0) });
        ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (ContinuationToken);
      return out;
    },
    async listVersions(Prefix) {
      const out: { key: string; versionId: string; isLatest: boolean }[] = [];
      let KeyMarker: string | undefined;
      let VersionIdMarker: string | undefined;
      do {
        const page = await client.send(new ListObjectVersionsCommand({ Bucket, Prefix, KeyMarker, VersionIdMarker }));
        for (const v of [...(page.Versions || []), ...(page.DeleteMarkers || [])]) {
          if (v.Key && v.VersionId) out.push({ key: v.Key, versionId: v.VersionId, isLatest: Boolean(v.IsLatest) });
        }
        KeyMarker = page.IsTruncated ? page.NextKeyMarker : undefined;
        VersionIdMarker = page.IsTruncated ? page.NextVersionIdMarker : undefined;
      } while (KeyMarker);
      return out;
    },
    async deleteVersions(items) {
      let deleted = 0;
      for (let i = 0; i < items.length; i += 1000) {
        const chunk = items.slice(i, i + 1000);
        await client.send(new DeleteObjectsCommand({
          Bucket,
          Delete: { Objects: chunk.map((v) => ({ Key: v.key, VersionId: v.versionId })), Quiet: true },
        }));
        deleted += chunk.length;
      }
      return deleted;
    },
  };
}
