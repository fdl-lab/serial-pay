import { NextResponse } from "next/server";
import { autoCompleteExpired } from "@/services/complete";
import { expireUnrevealedTransactions } from "@/services/reveal-cancel";
import { markExpiredListingsSoldOut } from "@/services/listing";
import { releaseExpiredPendingCheckouts } from "@/services/checkout";
import { purgeExpiredDisputeRecordings } from "@/services/dispute";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron: 毎日
 * - 応募期限切れ出品 → 販売終了（SOLD_OUT）
 * - 決済途中離脱の在庫予約 → 解放
 * - 開示期限切れ（未開示）→ 返金なしで売上確定 + 購入者評価1（お試しは評価なし）
 * - 確認期限切れ → 自動完了
 * - 異議画録の保持期限切れ → R2/S3 から削除
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  await markExpiredListingsSoldOut();
  const releasedCheckouts = await releaseExpiredPendingCheckouts();
  const forfeitedUnrevealed = await expireUnrevealedTransactions();
  const autoCompleted = await autoCompleteExpired();
  const recordingPurge = await purgeExpiredDisputeRecordings();

  return NextResponse.json({
    ok: true,
    releasedCheckouts: releasedCheckouts.length,
    forfeitedUnrevealed: forfeitedUnrevealed.length,
    autoCompleted: autoCompleted.length,
    recordingPurge: {
      retentionDays: recordingPurge.retentionDays,
      scanned: recordingPurge.scanned,
      purged: recordingPurge.purged,
    },
  });
}
