import { randomUUID } from "crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ApiError } from "@/lib/api";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
/** data URL フォールバック用（圧縮後を想定） */
export const AVATAR_DATA_URL_MAX_BYTES = 400 * 1024;

export const AVATAR_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/jpg",
]);

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

function extForMime(mime: string) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

export function inferImageMime(fileName: string, declaredType: string): string {
  const t = (declaredType || "").toLowerCase().trim();
  if (AVATAR_ALLOWED_MIME.has(t)) {
    return t === "image/jpg" ? "image/jpeg" : t;
  }
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "";
}

export function assertAvatarMeta(opts: { contentType: string; size: number }) {
  const mime =
    opts.contentType === "image/jpg" ? "image/jpeg" : opts.contentType;
  if (!AVATAR_ALLOWED_MIME.has(mime)) {
    throw new ApiError(
      400,
      "画像は JPEG / PNG / WebP / GIF にしてください（iPhoneは「互換性のあるフォーマット」で保存してください）",
      "INVALID_MEDIA_TYPE",
    );
  }
  if (opts.size <= 0 || opts.size > AVATAR_MAX_BYTES) {
    throw new ApiError(400, "プロフィール画像は2MB以内にしてください", "FILE_TOO_LARGE");
  }
}

export async function uploadAvatar(opts: {
  userId: string;
  buffer: Buffer;
  contentType: string;
  fileName?: string;
}) {
  const contentType =
    inferImageMime(opts.fileName ?? "", opts.contentType) || opts.contentType;

  assertAvatarMeta({
    contentType,
    size: opts.buffer.byteLength,
  });

  const mime = contentType === "image/jpg" ? "image/jpeg" : contentType;
  const ext = extForMime(mime);
  const objectKey = `${opts.userId}/${randomUUID()}.${ext}`;

  if (s3Configured()) {
    const bucket = process.env.S3_BUCKET!;
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `avatars/${objectKey}`,
        Body: opts.buffer,
        ContentType: mime,
      }),
    );
    const base = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
    const url = base
      ? `${base}/avatars/${objectKey}`
      : `s3://${bucket}/avatars/${objectKey}`;
    return { key: `avatars/${objectKey}`, url };
  }

  // Vercel など永続FSがない環境向け: 圧縮済み画像を data URL で保持
  if (opts.buffer.byteLength > AVATAR_DATA_URL_MAX_BYTES) {
    throw new ApiError(
      400,
      "画像が大きすぎます。もう一度選び直すか、別の写真をお試しください",
      "FILE_TOO_LARGE",
    );
  }

  const url = `data:${mime};base64,${opts.buffer.toString("base64")}`;
  return { key: `data:${opts.userId}/${objectKey}`, url };
}
