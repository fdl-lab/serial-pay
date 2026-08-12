import { randomUUID } from "crypto";
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ApiError } from "@/lib/api";

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export const AVATAR_ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const LOCAL_ROOT = path.join(process.cwd(), "uploads", "avatars");

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

export function assertAvatarMeta(opts: { contentType: string; size: number }) {
  if (!AVATAR_ALLOWED_MIME.has(opts.contentType)) {
    throw new ApiError(400, "画像は JPEG / PNG / WebP / GIF にしてね", "INVALID_MEDIA_TYPE");
  }
  if (opts.size <= 0 || opts.size > AVATAR_MAX_BYTES) {
    throw new ApiError(400, "プロフィール画像は2MB以内にしてね", "FILE_TOO_LARGE");
  }
}

export async function uploadAvatar(opts: {
  userId: string;
  buffer: Buffer;
  contentType: string;
}) {
  assertAvatarMeta({
    contentType: opts.contentType,
    size: opts.buffer.byteLength,
  });

  const ext = extForMime(opts.contentType);
  const objectKey = `${opts.userId}/${randomUUID()}.${ext}`;

  if (s3Configured()) {
    const bucket = process.env.S3_BUCKET!;
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: `avatars/${objectKey}`,
        Body: opts.buffer,
        ContentType: opts.contentType,
      }),
    );
    const base = process.env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
    const url = base
      ? `${base}/avatars/${objectKey}`
      : `s3://${bucket}/avatars/${objectKey}`;
    return { key: `avatars/${objectKey}`, url };
  }

  const absDir = path.join(LOCAL_ROOT, opts.userId);
  await mkdir(absDir, { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(absDir, filename), opts.buffer);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000").replace(
    /\/$/,
    "",
  );
  return {
    key: `local/${opts.userId}/${filename}`,
    url: `${appUrl}/api/media/avatars/${opts.userId}/${filename}`,
  };
}

export async function readLocalAvatar(userId: string, filename: string) {
  if (userId.includes("..") || filename.includes("..") || filename.includes("/")) {
    throw new ApiError(400, "不正なパスです", "BAD_PATH");
  }
  return readFile(path.join(LOCAL_ROOT, userId, filename));
}
