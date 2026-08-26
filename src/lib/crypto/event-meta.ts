import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const AAD = Buffer.from("serial-pay:event-meta:v1");

function getKey(): Buffer {
  const raw = process.env.SERIAL_ENCRYPTION_KEY;
  if (!raw) throw new Error("SERIAL_ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("SERIAL_ENCRYPTION_KEY must be 32 bytes (base64-encoded)");
  }
  return key;
}

/** 表示用に正規化（前後空白のみ）。検索・照合用ではない。 */
export function normalizeEventMeta(plaintext: string): string {
  return plaintext.normalize("NFKC").trim();
}

/**
 * イベント／アーティスト名の保管用暗号化。
 * 毎回ランダム IV のため、同一文言でも暗号文は一致せず DB 上でイベント単位の集計ができない。
 */
export function encryptEventMeta(plaintext: string): string {
  const normalized = normalizeEventMeta(plaintext);
  if (!normalized) return "";
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  cipher.setAAD(AAD);
  const encrypted = Buffer.concat([
    cipher.update(normalized, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptEventMeta(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid event-meta ciphertext format");
  }
  const decipher = createDecipheriv(
    ALGO,
    getKey(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAAD(AAD);
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/** iv.tag.cipher 形式か（レガシー平文との判別） */
export function looksLikeEventMetaCiphertext(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  return parts.every((p) => p.length > 0 && /^[A-Za-z0-9+/=]+$/.test(p));
}

/**
 * DB 保管値 → 画面表示用平文。
 * 移行前の平文はそのまま返す。
 */
export function revealEventMeta(
  stored: string | null | undefined,
): string | null {
  if (stored == null || stored === "") return null;
  if (!looksLikeEventMetaCiphertext(stored)) return stored;
  try {
    return decryptEventMeta(stored);
  } catch {
    return stored;
  }
}

export function sealArtistAndEvent(input: {
  artistName: string;
  eventName?: string | null;
}) {
  const artist = normalizeEventMeta(input.artistName);
  const event = input.eventName ? normalizeEventMeta(input.eventName) : "";
  return {
    artistName: artist ? encryptEventMeta(artist) : null,
    eventName: event ? encryptEventMeta(event) : null,
  };
}

export function openArtistAndEvent<T extends {
  artistName?: string | null;
  eventName?: string | null;
}>(row: T): T {
  return {
    ...row,
    artistName: revealEventMeta(row.artistName ?? null),
    eventName: revealEventMeta(row.eventName ?? null),
  };
}
