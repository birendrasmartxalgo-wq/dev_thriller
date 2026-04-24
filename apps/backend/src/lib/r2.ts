import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env, r2Configured } from "@/config/env";

let client: S3Client | null = null;
export function r2(): S3Client {
  if (!r2Configured) {
    throw new Error("R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env.");
  }
  if (!client) {
    client = new S3Client({
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return client;
}

export async function createMultipart(key: string, mime: string) {
  const res = await r2().send(
    new CreateMultipartUploadCommand({ Bucket: env.R2_BUCKET, Key: key, ContentType: mime })
  );
  if (!res.UploadId) throw new Error("R2 did not return UploadId");
  return res.UploadId;
}

export async function signPartUrl(key: string, uploadId: string, partNumber: number, ttlSec = 3600) {
  return getSignedUrl(
    r2(),
    new UploadPartCommand({ Bucket: env.R2_BUCKET, Key: key, UploadId: uploadId, PartNumber: partNumber }),
    { expiresIn: ttlSec }
  );
}

export async function completeMultipart(
  key: string,
  uploadId: string,
  parts: { n: number; etag: string }[]
) {
  await r2().send(
    new CompleteMultipartUploadCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
          .sort((a, b) => a.n - b.n)
          .map((p) => ({ PartNumber: p.n, ETag: p.etag })),
      },
    })
  );
}

export async function abortMultipart(key: string, uploadId: string) {
  try {
    await r2().send(new AbortMultipartUploadCommand({ Bucket: env.R2_BUCKET, Key: key, UploadId: uploadId }));
  } catch {
    // ignore
  }
}

export async function signDownloadUrl(key: string, ttlSec = 900) {
  return getSignedUrl(r2(), new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }), { expiresIn: ttlSec });
}

export async function deleteObject(key: string) {
  await r2().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
}

export async function statObject(key: string) {
  return r2().send(new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
}

export function fileKey(workspaceId: string, fileId: string, version: number, filename: string) {
  const safe = filename.replace(/[^\w.\- ]/g, "_");
  return `workspaces/${workspaceId}/files/${fileId}/v${version}/${safe}`;
}
