import type { User } from "@prisma/client";
import { getMeStatus } from "@/services/auth";
import { getWalletSummary } from "@/services/wallet";
import { listUserMessages } from "@/services/messages";
import { listSellerListings } from "@/services/listing";
import {
  listPendingBuyerRatings,
  listSellerRatings,
} from "@/services/rating";
import {
  listBuyerPurchaseHistory,
  listBuyerPurchases,
} from "@/services/checkout";
import { listFavorites } from "@/services/favorites";
import { listMyListingCommentInbox } from "@/services/listing-comments";

function iso(d: Date | string | null | undefined) {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

/** マイページ用: 認証1回 + データ並列取得 */
export async function getMeDashboard(user: User) {
  const [
    profile,
    wallet,
    messages,
    listings,
    pendingRatings,
    purchases,
    purchaseHistory,
    receivedRatings,
    favorites,
    listingComments,
  ] = await Promise.all([
    getMeStatus(user),
    getWalletSummary(user.id),
    listUserMessages(user.id),
    listSellerListings(user.id),
    listPendingBuyerRatings(user.id),
    listBuyerPurchases(user.id),
    listBuyerPurchaseHistory(user.id),
    listSellerRatings(user.id, 30),
    listFavorites(user.id),
    listMyListingCommentInbox(user.id),
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
    favorites: {
      favorites: favorites.map((f) => ({
        itemId: f.itemId,
        createdAt: iso(f.createdAt)!,
        item: f.item,
      })),
    },
    listingComments: {
      onMyListings: listingComments.onMyListings.map((c) => ({
        ...c,
        createdAt: iso(c.createdAt)!,
      })),
      authored: listingComments.authored.map((c) => ({
        ...c,
        createdAt: iso(c.createdAt)!,
      })),
    },
    listings: { items: listings },
    ratings: {
      pending: pendingRatings,
      received: receivedRatings.map((r) => ({
        ...r,
        createdAt: iso(r.createdAt)!,
      })),
    },
    purchases: {
      purchases: purchases.map((p) => ({
        ...p,
        codeRevealedAt: iso(p.codeRevealedAt),
        revealDeadlineAt: iso(p.revealDeadlineAt),
        reservedUntil: iso(p.reservedUntil),
        confirmationDeadlineAt: iso(p.confirmationDeadlineAt),
        buyerConfirmedAt: iso(p.buyerConfirmedAt),
        createdAt: iso(p.createdAt)!,
      })),
      history: purchaseHistory.map((p) => ({
        ...p,
        codeRevealedAt: iso(p.codeRevealedAt),
        createdAt: iso(p.createdAt)!,
        completedAt: iso(p.completedAt)!,
      })),
    },
  };
}
