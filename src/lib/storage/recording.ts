import { randomUUID } from "crypto";
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ApiError } from "@/lib/api";

/** 異議用画録は必要箇所のみ・3分以内 */
export const RECORDING_MAX_DURATION_SEC = 180;
/** ざっくり 3分のスマホ画録を想定（〜100MB） */
export const RECORDING_MAX_BYTES = 100 * 1024 * 1024;

export const RECORDING_ALLOWED_MIME = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
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
  return "mp4";
}

export async function uploadDisputeRecording(opts: {
  buyerId: string;
  transactionId: string;
  buffer: Buffer;
  contentType: string;
}) {
  assertRecordingFileMeta({
    contentType: opts.contentType,
    size: opts.buffer.byteLength,
  });

  const ext = extForMime(opts.contentType);
  const objectKey = `${opts.buyerId}/${opts.transactionId}/${randomUUID()}.${ext}`;

  if (s3Configured()) {
    const bucket = process.env.S3_BUCKET!;
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `disputes/${objectKey}`,
        Body: opts.buffer,
        ContentType: opts.contentType,
      }),
    );

    const base = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
    const url = base
      ? `${base}/disputes/${objectKey}`
      : `s3://${bucket}/disputes/${objectKey}`;

    return { key: `disputes/${objectKey}`, url };
  }

  // ローカル開発用フォールバック
  const absDir = path.join(LOCAL_ROOT, opts.buyerId, opts.transactionId);
  await mkdir(absDir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  const absPath = path.join(absDir, filename);
  await writeFile(absPath, opts.buffer);

  const key = `local/${opts.buyerId}/${opts.transactionId}/${filename}`;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000").replace(
    /\/$/,
    "",
  );
  return {
    key,
    url: `${appUrl}/api/media/disputes/${opts.buyerId}/${opts.transactionId}/${filename}`,
  };
}

export async function readLocalDisputeRecording(
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
  const absPath = path.join(LOCAL_ROOT, buyerId, transactionId, filename);
  return readFile(absPath);
}
