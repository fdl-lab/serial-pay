import { autoCompleteExpired } from "@/services/complete";
import { expireUnrevealedTransactions } from "@/services/reveal-cancel";

/**
 * Cron / 手動実行用:
 * 1) 開示期限切れ（未開示）→ 自動キャンセル・返金・購入者評価1
 * 2) 確認期限切れ → 自動完了して出品者へ売上
 *
 * 例: npx tsx scripts/auto-complete.ts
 */
async function main() {
  const expiredUnrevealed = await expireUnrevealedTransactions();
  const autoCompleted = await autoCompleteExpired();
  console.log(
    JSON.stringify(
      {
        expiredUnrevealed: {
          processed: expiredUnrevealed.length,
          results: expiredUnrevealed,
        },
        autoCompleted: {
          processed: autoCompleted.length,
          results: autoCompleted,
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
