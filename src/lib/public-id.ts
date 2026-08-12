import { randomInt } from "crypto";
import { prisma } from "@/lib/prisma";

const PUBLIC_ID_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** 変更不可の公開ID。例: SP-A2B9K7MQ */
export function generatePublicId(): string {
  let body = "";
  for (let i = 0; i < 8; i++) {
    body += PUBLIC_ID_ALPHABET[randomInt(PUBLIC_ID_ALPHABET.length)];
  }
  return `SP-${body}`;
}

export async function allocatePublicId(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const publicId = generatePublicId();
    const exists = await prisma.user.findUnique({
      where: { publicId },
      select: { id: true },
    });
    if (!exists) return publicId;
  }
  throw new Error("公開IDの発行に失敗しました");
}

/** 既存ユーザーに publicId が無い場合の補完 */
export async function ensurePublicId(userId: string, current?: string | null) {
  if (current) return current;
  const publicId = await allocatePublicId();
  await prisma.user.update({
    where: { id: userId },
    data: { publicId },
  });
  return publicId;
}
