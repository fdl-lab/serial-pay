import { autoCompleteExpired } from "@/services/complete";
import { expireUnrevealedTransactions } from "@/services/reveal-cancel";

/**
 * Cron / 手動実行用:
 * 1) 開示期限切れ（未開示）→ 返金なしで売上確定・購入者評価1
 * 2) 確認期限切れ → 自動完了して出品者へ売上
 *
 * 例: npx tsx scripts/auto-complete.ts
 */
async function main() {
  const forfeitedUnrevealed = await expireUnrevealedTransactions();
  const autoCompleted = await autoCompleteExpired();
  console.log(
    JSON.stringify(
      {
        forfeitedUnrevealed: {
          processed: forfeitedUnrevealed.length,
          results: forfeitedUnrevealed,
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
