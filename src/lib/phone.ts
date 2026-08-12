/** 日本の携帯番号を E.164 に（09012345678 → +819012345678） */
export function toE164Japan(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("81") && digits.length >= 11) {
    return `+${digits}`;
  }
  if (digits.startsWith("0") && digits.length === 11) {
    return `+81${digits.slice(1)}`;
  }
  if (digits.length === 10 && digits.startsWith("9")) {
    return `+81${digits}`;
  }
  return null;
}
