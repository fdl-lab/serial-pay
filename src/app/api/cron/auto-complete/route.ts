import { NextResponse } from "next/server";
import { autoCompleteExpired } from "@/services/complete";
import { expireUnrevealedTransactions } from "@/services/reveal-cancel";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron: 毎時
 * - 開示期限切れ → キャンセル返金 + 購入者評価1
 * - 確認期限切れ → 自動完了
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const expiredUnrevealed = await expireUnrevealedTransactions();
  const autoCompleted = await autoCompleteExpired();

  return NextResponse.json({
    ok: true,
    expiredUnrevealed: expiredUnrevealed.length,
    autoCompleted: autoCompleted.length,
  });
}
