import type { User } from "@prisma/client";
import { getMeStatus } from "@/services/auth";
import { getWalletSummary } from "@/services/wallet";
import { listUserMessages } from "@/services/messages";
import { listSellerListings } from "@/services/listing";
import { listPendingBuyerRatings } from "@/services/rating";
import { listBuyerPurchases } from "@/services/checkout";

function iso(d: Date | string | null | undefined) {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

/** マイページ用: 認証1回 + データ並列取得 */
export async function getMeDashboard(user: User) {
  const [profile, wallet, messages, listings, pendingRatings, purchases] =
    await Promise.all([
      getMeStatus(user),
      getWalletSummary(user.id),
      listUserMessages(user.id),
      listSellerListings(user.id),
      listPendingBuyerRatings(user.id),
      listBuyerPurchases(user.id),
    ]);

  return {
    user: profile,
    wallet: {
      balanceYen: wallet.wallet.balanceYen,
      pendingYen: wallet.wallet.pendingYen,
      payoutFeeYen: wallet.payoutFeeYen,
      connectStatus: user.stripeConnectStatus,
      recent: wallet.recent.map((row) => ({
        id: row.id,
        type: row.type,
        amountYen: row.amountYen,
        createdAt: iso(row.createdAt)!,
        description: row.description,
      })),
      payouts: wallet.payouts.map((p) => ({
        id: p.id,
        amountYen: p.amountYen,
        feeYen: p.feeYen,
        status: p.status,
        createdAt: iso(p.createdAt)!,
      })),
    },
    messages: {
      messages: messages.map((m) => ({
        ...m,
        createdAt: iso(m.createdAt)!,
        readAt: iso(m.readAt),
      })),
      unreadCount: messages.filter((m) => m.unread).length,
    },
    listings: { items: listings },
    ratings: { pending: pendingRatings },
    purchases: {
      purchases: purchases.map((p) => ({
        ...p,
        codeRevealedAt: iso(p.codeRevealedAt),
        revealDeadlineAt: iso(p.revealDeadlineAt),
        confirmationDeadlineAt: iso(p.confirmationDeadlineAt),
        buyerConfirmedAt: iso(p.buyerConfirmedAt),
        createdAt: iso(p.createdAt)!,
      })),
    },
  };
}
