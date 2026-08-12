import { autoCompleteExpired } from "@/services/complete";

/**
 * Cron / 手動実行用: 確認期限切れ取引を自動完了して送金する
 * 例: npx tsx scripts/auto-complete.ts
 */
async function main() {
  const results = await autoCompleteExpired();
  console.log(JSON.stringify({ processed: results.length, results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
