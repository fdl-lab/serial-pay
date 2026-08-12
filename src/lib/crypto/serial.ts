import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function getKey(): Buffer {
  const raw = process.env.SERIAL_ENCRYPTION_KEY;
  if (!raw) throw new Error("SERIAL_ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("SERIAL_ENCRYPTION_KEY must be 32 bytes (base64-encoded)");
  }
  return key;
}

function getPepper(): string {
  const pepper = process.env.SERIAL_CODE_HASH_PEPPER;
  if (!pepper) throw new Error("SERIAL_CODE_HASH_PEPPER is not set");
  return pepper;
}

/** 平文シリアルを AES-256-GCM で暗号化。形式: iv.authTag.ciphertext（各 base64） */
export function encryptSerial(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptSerial(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Invalid ciphertext format");
  }
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/** 重複検出用。平文復元不可の HMAC。 */
export function hashSerial(plaintext: string): string {
  const normalized = plaintext.trim().toUpperCase();
  return createHmac("sha256", getPepper()).update(normalized).digest("hex");
}
