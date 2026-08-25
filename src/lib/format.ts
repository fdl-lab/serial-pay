export function formatYen(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** 開示期限までの残り（例: 残り約18時間 / 残り約2日） */
export function formatRemainingUntil(
  deadline: Date | string | null | undefined,
  now = new Date(),
): string | null {
  if (!deadline) return null;
  const end = deadline instanceof Date ? deadline : new Date(deadline);
  if (Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - now.getTime();
  if (ms <= 0) return "期限切れ";

  const totalMin = Math.ceil(ms / 60_000);
  if (totalMin < 60) return `残り約${totalMin}分`;

  const totalHours = Math.ceil(ms / 3_600_000);
  if (totalHours < 48) return `残り約${totalHours}時間`;

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (hours === 0) return `残り約${days}日`;
  return `残り約${days}日${hours}時間`;
}
