import { randomUUID } from "crypto";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import path from "path";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { ApiError } from "@/lib/api";

/** 異議用画録は必要箇所のみ・3分以内 */
export const RECORDING_MAX_DURATION_SEC = 180;
export const RECORDING_MAX_BYTES = 100 * 1024 * 1024;
/**
 * Vercel のリクエスト上限（約4.5MB）未満。
 * ※S3 Multipart の最小パート(5MB)は使わず、一時オブジェクトへ分割保存して結合する。
 */
export const RECORDING_CHUNK_BYTES = 2 * 1024 * 1024;

export const RECORDING_ALLOWED_MIME = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "video/mpeg",
]);

const LOCAL_ROOT = path.join(process.cwd(), "uploads", "disputes");

function s3Configured() {
  return Boolean(
    process.env.S3_BUCKET &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY,
  );
}

function getS3Client() {
  return new S3Client({
    region: process.env.S3_REGION || "ap-northeast-1",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
    },
  });
}

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
}

function s3ErrorMessage(e: unknown) {
  if (!e || typeof e !== "object") return "ストレージへの保存に失敗しました";
  const err = e as { name?: string; message?: string; Code?: string };
  const code = err.name || err.Code;
  if (code === "AccessDenied" || code === "InvalidAccessKeyId") {
    return "ストレージ設定を確認してください（権限エラー）";
  }
  return "ストレージへの保存に失敗しました。時間をおいてもう一度お試しください";
}

export function normalizeRecordingMime(
  contentType: string | null | undefined,
  fileName?: string | null,
): string {
  const raw = (contentType || "").toLowerCase().trim();
  if (RECORDING_ALLOWED_MIME.has(raw)) return raw;

  const name = (fileName || "").toLowerCase();
  if (name.endsWith(".mov") || name.endsWith(".qt")) return "video/quicktime";
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".m4v")) return "video/x-m4v";
  if (name.endsWith(".mp4") || name.endsWith(".m4a")) return "video/mp4";
  if (raw.startsWith("video/")) return "video/mp4";
  return "video/mp4";
}

export function assertRecordingFileMeta(opts: {
  contentType: string;
  size: number;
}) {
  if (!RECORDING_ALLOWED_MIME.has(opts.contentType)) {
    throw new ApiError(
      400,
      "対応形式は MP4 / MOV / WebM です",
      "INVALID_MEDIA_TYPE",
    );
  }
  if (opts.size <= 0 || opts.size > RECORDING_MAX_BYTES) {
    throw new ApiError(
      400,
      "動画は100MB以内にしてください（必要箇所を3分以内に切り取り）",
      "FILE_TOO_LARGE",
    );
  }
}

function extForMime(mime: string) {
  if (mime === "video/webm") return "webm";
  if (mime === "video/quicktime") return "mov";
  if (mime === "video/x-m4v") return "m4v";
  return "mp4";
}

function publicUrlForKey(objectKey: string) {
  const base = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (base) return `${base}/disputes/${objectKey}`;
  return `${appBaseUrl()}/api/media/disputes/${objectKey}`;
}

function partObjectKey(uploadId: string, partNumber: number) {
  return `disputes/_parts/${uploadId}/${partNumber}`;
}

export async function initDisputeRecordingUpload(opts: {
  buyerId: string;
  transactionId: string;
  contentType: string;
  fileName?: string | null;
  size: number;
}) {
  const contentType = normalizeRecordingMime(opts.contentType, opts.fileName);
  assertRecordingFileMeta({ contentType, size: opts.size });

  const ext = extForMime(contentType);
  const objectKey = `${opts.buyerId}/${opts.transactionId}/${randomUUID()}.${ext}`;
  const key = `disputes/${objectKey}`;
  const uploadId = randomUUID();

  if (!s3Configured()) {
    // Vercel など永続ディスクがない環境ではローカル保存不可
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      throw new ApiError(
        503,
        "画録ストレージ（S3/R2）が未設定か無効です。管理者に連絡してください",
        "STORAGE_NOT_CONFIGURED",
      );
    }
    return {
      key,
      uploadId: `local-${uploadId}`,
      contentType,
      chunkBytes: RECORDING_CHUNK_BYTES,
      mode: "local" as const,
    };
  }

  return {
    key,
    uploadId,
    contentType,
    chunkBytes: RECORDING_CHUNK_BYTES,
    mode: "s3" as const,
  };
}

export async function uploadDisputeRecordingPart(opts: {
  key: string;
  uploadId: string;
  partNumber: number;
  buffer: Buffer;
  mode: "s3" | "local";
}) {
  if (opts.partNumber < 1 || opts.partNumber > 10000) {
    throw new ApiError(400, "不正な分割番号です", "BAD_PART");
  }
  if (
    opts.buffer.byteLength <= 0 ||
    opts.buffer.byteLength > RECORDING_CHUNK_BYTES + 64 * 1024
  ) {
    throw new ApiError(400, "分割サイズが不正です", "BAD_CHUNK");
  }

  if (opts.mode === "local" || opts.uploadId.startsWith("local-")) {
    const absDir = path.join(LOCAL_ROOT, "_parts", opts.uploadId);
    await mkdir(absDir, { recursive: true });
    await writeFile(path.join(absDir, String(opts.partNumber)), opts.buffer);
    return { etag: `local-part-${opts.partNumber}` };
  }

  try {
    const client = getS3Client();
    const res = await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: partObjectKey(opts.uploadId, opts.partNumber),
        Body: opts.buffer,
        ContentType: "application/octet-stream",
      }),
    );
    return { etag: res.ETag || `part-${opts.partNumber}` };
  } catch (e) {
    console.error("dispute upload part failed", e);
    throw new ApiError(500, s3ErrorMessage(e), "UPLOAD_PART");
  }
}

async function deleteS3PartObjects(
  client: S3Client,
  uploadId: string,
  partNumbers: number[],
) {
  if (partNumbers.length === 0) return;
  const Objects = partNumbers.map((n) => ({
    Key: partObjectKey(uploadId, n),
  }));
  try {
    await client.send(
      new DeleteObjectsCommand({
        Bucket: process.env.S3_BUCKET!,
        Delete: { Objects, Quiet: true },
      }),
    );
  } catch {
    /* best effort */
  }
}

export async function completeDisputeRecordingUpload(opts: {
  key: string;
  uploadId: string;
  parts: { partNumber: number; etag: string }[];
  mode: "s3" | "local";
  contentType?: string;
}) {
  const sorted = [...opts.parts].sort((a, b) => a.partNumber - b.partNumber);
  if (sorted.length === 0) {
    throw new ApiError(400, "アップロードデータが空です", "NO_PARTS");
  }

  const contentType = normalizeRecordingMime(opts.contentType, opts.key);

  if (opts.mode === "local" || opts.uploadId.startsWith("local-")) {
    const absDir = path.join(LOCAL_ROOT, "_parts", opts.uploadId);
    const chunks: Buffer[] = [];
    for (const p of sorted) {
      chunks.push(await readFile(path.join(absDir, String(p.partNumber))));
    }
    const buffer = Buffer.concat(chunks);
    const rel = opts.key.replace(/^disputes\//, "");
    const absPath = path.join(LOCAL_ROOT, rel);
    await mkdir(path.dirname(absPath), { recursive: true });
    await writeFile(absPath, buffer);
    await rm(absDir, { recursive: true, force: true }).catch(() => undefined);
    return {
      key: opts.key,
      url: `${appBaseUrl()}/api/media/disputes/${rel}`,
    };
  }

  const client = getS3Client();
  const partNumbers = sorted.map((p) => p.partNumber);

  try {
    const chunks: Buffer[] = [];
    for (const p of sorted) {
      const got = await client.send(
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key: partObjectKey(opts.uploadId, p.partNumber),
        }),
      );
      const bytes = await got.Body?.transformToByteArray();
      if (!bytes || bytes.byteLength === 0) {
        throw new ApiError(500, "分割データの取得に失敗しました", "PART_MISSING");
      }
      chunks.push(Buffer.from(bytes));
    }

    const buffer = Buffer.concat(chunks);
    if (buffer.byteLength <= 0 || buffer.byteLength > RECORDING_MAX_BYTES) {
      throw new ApiError(400, "結合後のファイルサイズが不正です", "BAD_SIZE");
    }

    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: opts.key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
  } catch (e) {
    if (e instanceof ApiError) throw e;
    console.error("dispute upload complete failed", e);
    throw new ApiError(500, s3ErrorMessage(e), "UPLOAD_COMPLETE");
  } finally {
    await deleteS3PartObjects(client, opts.uploadId, partNumbers);
  }

  const objectKey = opts.key.replace(/^disputes\//, "");
  return { key: opts.key, url: publicUrlForKey(objectKey) };
}

export async function uploadDisputeRecording(opts: {
  buyerId: string;
  transactionId: string;
  buffer: Buffer;
  contentType: string;
  fileName?: string | null;
}) {
  const contentType = normalizeRecordingMime(opts.contentType, opts.fileName);
  assertRecordingFileMeta({
    contentType,
    size: opts.buffer.byteLength,
  });

  const ext = extForMime(contentType);
  const objectKey = `${opts.buyerId}/${opts.transactionId}/${randomUUID()}.${ext}`;

  if (s3Configured()) {
    const bucket = process.env.S3_BUCKET!;
    const client = getS3Client();
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: `disputes/${objectKey}`,
          Body: opts.buffer,
          ContentType: contentType,
        }),
      );
    } catch (e) {
      console.error("dispute upload failed", e);
      throw new ApiError(500, s3ErrorMessage(e), "UPLOAD_FAILED");
    }
    return { key: `disputes/${objectKey}`, url: publicUrlForKey(objectKey) };
  }

  const absDir = path.join(LOCAL_ROOT, opts.buyerId, opts.transactionId);
  await mkdir(absDir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(absDir, filename), opts.buffer);
  const key = `local/${opts.buyerId}/${opts.transactionId}/${filename}`;
  return {
    key,
    url: `${appBaseUrl()}/api/media/disputes/${opts.buyerId}/${opts.transactionId}/${filename}`,
  };
}

export async function readDisputeRecording(
  buyerId: string,
  transactionId: string,
  filename: string,
) {
  if (
    buyerId.includes("..") ||
    transactionId.includes("..") ||
    filename.includes("..") ||
    filename.includes("/")
  ) {
    throw new ApiError(400, "不正なパスです", "BAD_PATH");
  }

  if (s3Configured()) {
    try {
      const client = getS3Client();
      const got = await client.send(
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key: `disputes/${buyerId}/${transactionId}/${filename}`,
        }),
      );
      const bytes = await got.Body?.transformToByteArray();
      if (!bytes) {
        throw new ApiError(404, "画録が見つかりません", "NOT_FOUND");
      }
      return Buffer.from(bytes);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      console.error("dispute recording read failed", e);
      throw new ApiError(404, "画録が見つかりません", "NOT_FOUND");
    }
  }

  const absPath = path.join(LOCAL_ROOT, buyerId, transactionId, filename);
  return readFile(absPath);
}

/** @deprecated use readDisputeRecording */
export async function readLocalDisputeRecording(
  buyerId: string,
  transactionId: string,
  filename: string,
) {
  return readDisputeRecording(buyerId, transactionId, filename);
}

/**
 * 異議画録オブジェクトを削除（R2/S3 or ローカル）。
 * key 例: disputes/{buyerId}/{txId}/{file}.mp4
 */
export async function deleteDisputeRecordingObject(key: string | null | undefined) {
  if (!key || key === "(purged)" || key.startsWith("purged:")) {
    return { deleted: false, reason: "no_key" as const };
  }

  // 安全のため disputes/ 配下のみ
  if (!key.startsWith("disputes/") && !key.startsWith("local/")) {
    console.warn("refuse delete: unexpected recording key", key);
    return { deleted: false, reason: "bad_key" as const };
  }
  if (key.includes("..")) {
    return { deleted: false, reason: "bad_key" as const };
  }

  if (key.startsWith("local/") || !s3Configured()) {
    const absPath = path.join(
      LOCAL_ROOT,
      key.replace(/^disputes\//, "").replace(/^local\//, ""),
    );
    try {
      await rm(absPath, { force: true });
      return { deleted: true, reason: "ok" as const };
    } catch (e) {
      console.error("local recording delete failed", e);
      return { deleted: false, reason: "error" as const };
    }
  }

  try {
    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
      }),
    );
    return { deleted: true, reason: "ok" as const };
  } catch (e) {
    console.error("dispute recording delete failed", e);
    return { deleted: false, reason: "error" as const };
  }
}
