import { jsonOk, jsonError, requireUser } from "@/lib/api";
import { getWalletSummary, PAYOUT_FEE_YEN } from "@/services/wallet";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    try {
      const summary = await getWalletSummary(user.id);
      return jsonOk({
        balanceYen: summary.wallet.balanceYen,
        pendingYen: summary.wallet.pendingYen,
        payoutFeeYen: summary.payoutFeeYen,
        recent: summary.recent,
        payouts: summary.payouts,
        connectStatus: user.stripeConnectStatus,
      });
    } catch {
      // DB 未接続でもマイページ UI を確認できるようにプレビューデータを返す
      if (process.env.DEV_AUTH_BYPASS === "true") {
        return jsonOk({
          balanceYen: 12800,
          pendingYen: 0,
          payoutFeeYen: PAYOUT_FEE_YEN,
          recent: [
            {
              id: "preview-1",
              type: "SALE_CREDIT",
              amountYen: 10800,
              createdAt: new Date().toISOString(),
              description: "（プレビュー）取引完了による売上加算",
            },
            {
              id: "preview-2",
              type: "PAYOUT_FEE",
              amountYen: -200,
              createdAt: new Date(Date.now() - 86400000).toISOString(),
              description: "（プレビュー）出金振込手数料",
            },
          ],
          payouts: [],
          connectStatus: user.stripeConnectStatus,
          preview: true,
        });
      }
      throw new Error("wallet unavailable");
    }
  } catch (e) {
    return jsonError(e);
  }
}
