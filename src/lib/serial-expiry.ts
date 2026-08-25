/** 応募期限の何分前から出品・購入を止めるか */
export const SERIAL_EXPIRY_BUFFER_MINUTES = 30;
export const SERIAL_EXPIRY_BUFFER_MS = SERIAL_EXPIRY_BUFFER_MINUTES * 60 * 1000;

export function purchaseCutoffAt(expiresAt: Date): Date {
  return new Date(expiresAt.getTime() - SERIAL_EXPIRY_BUFFER_MS);
}

/** 公開一覧・購入可能か（期限の30分前まで） */
export function canSellOrBuyByExpiry(
  expiresAt: Date | null | undefined,
  now = new Date(),
): boolean {
  if (!expiresAt) return true;
  return now.getTime() < purchaseCutoffAt(expiresAt).getTime();
}

export function isPastSerialExpiry(
  expiresAt: Date | null | undefined,
  now = new Date(),
): boolean {
  if (!expiresAt) return false;
  return now.getTime() >= expiresAt.getTime();
}

export function isSerialExpiryTooSoon(
  expiresAt: Date,
  now = new Date(),
): boolean {
  if (Number.isNaN(expiresAt.getTime())) return true;
  return expiresAt.getTime() <= now.getTime() + SERIAL_EXPIRY_BUFFER_MS;
}

/** datetime-local 用（ローカル表示） */
export function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error("応募期限が正しくありません");
  }
  return d;
}

/** datetime-local の min 属性（いま+30分） */
export function minDatetimeLocalValue(now = new Date()): string {
  return toDatetimeLocalValue(
    new Date(now.getTime() + SERIAL_EXPIRY_BUFFER_MS + 60_000),
  );
}
