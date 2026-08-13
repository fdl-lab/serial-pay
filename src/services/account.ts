import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import {
  LINE_REJOIN_COOLDOWN_DAYS,
  markLineIdentityDeleted,
} from "@/services/line-identity";
import { creditWalletRefund } from "@/services/wallet";

/** 退会を阻む未完了ステータス */
const OPEN_TX_STATUSES = [
  "PENDING_PAYMENT",
  "PAID_ESCROW",
  "CONFIRMATION_WINDOW",
  "DISPUTED",
] as const;

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "支払い待ち",
  PAID_ESCROW: "開示前",
  CONFIRMATION_WINDOW: "確認・評価待ち",
  DISPUTED: "異議中",
};

export async function listOpenTransactions(userId: string) {
  const rows = await prisma.transaction.findMany({
    where: {
      status: { in: [...OPEN_TX_STATUSES] },
      OR: [{ buyerId: userId }, { sellerId: userId }],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      item: { select: { title: true } },
    },
  });

  return rows.map((tx) => ({
    id: tx.id,
    status: tx.status,
    statusLabel: STATUS_LABEL[tx.status] ?? tx.status,
    role: tx.buyerId === userId ? ("buyer" as const) : ("seller" as const),
    itemTitle: tx.item.title,
    amountChargedYen: tx.amountChargedYen,
    cancellable: tx.status === "PENDING_PAYMENT" && tx.buyerId === userId,
  }));
}

export async function getAccountDeletionBlockers(userId: string) {
  const openTransactions = await listOpenTransactions(userId);
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: { balanceYen: true, pendingYen: true },
  });

  const blockers: string[] = [];
  if (openTransactions.length > 0) {
    blockers.push(
      `未完了の取引が${openTransactions.length}件あります。完了・キャンセルしてから退会してください`,
    );
  }
  if (wallet && wallet.pendingYen > 0) {
    blockers.push("出金申請中の残高があります。完了を待ってから退会してください");
  }

  return {
    canDelete: blockers.length === 0,
    blockers,
    openTransactions,
    openTransactionCount: openTransactions.length,
    walletBalanceYen: wallet?.balanceYen ?? 0,
    walletPendingYen: wallet?.pendingYen ?? 0,
    rejoinCooldownDays: LINE_REJOIN_COOLDOWN_DAYS,
  };
}

/** 支払い待ちの自分の購入をキャンセル（退会前の掃除用） */
export async function cancelOwnPendingPayment(userId: string, transactionId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });
  if (!tx || tx.buyerId !== userId) {
    throw new ApiError(404, "取引が見つかりません", "TX_NOT_FOUND");
  }
  if (tx.status !== "PENDING_PAYMENT") {
    throw new ApiError(409, "支払い待ち以外はここではキャンセルできません", "INVALID_STATE");
  }

  await prisma.$transaction(async (db) => {
    const reserved = await db.serialCode.findMany({
      where: { transactionId: tx.id, status: "RESERVED" },
      select: { id: true },
    });

    if (reserved.length > 0) {
      await db.serialCode.updateMany({
        where: { id: { in: reserved.map((c) => c.id) } },
        data: {
          status: "AVAILABLE",
          reservedAt: null,
          reservedUntil: null,
          transactionId: null,
        },
      });

      await db.item.update({
        where: { id: tx.itemId },
        data: {
          stockAvailable: { increment: reserved.length },
          status: "ACTIVE",
          soldOutAt: null,
        },
      });
    }

    if (tx.walletPaidYen > 0) {
      await creditWalletRefund(db, {
        buyerId: tx.buyerId,
        amountYen: tx.walletPaidYen,
        transactionId: tx.id,
      });
    }

    await db.transaction.update({
      where: { id: tx.id },
      data: {
        status: "CANCELLED",
        escrowStatus: "NONE",
      },
    });

    await db.auditLog.create({
      data: {
        actorUserId: userId,
        action: "TRANSACTION_PAYMENT_CANCELLED",
        entityType: "Transaction",
        entityId: tx.id,
        metadata: { reason: "account_delete_cleanup" },
      },
    });
  });

  return { cancelled: true, transactionId: tx.id };
}

/**
 * 退会（ソフト削除）。
 * - 同じアカウントは復活しない
 * - 同じ LINE は cooldown 日数のあいだ再登録不可
 * - 期限後は新規アカウント（新しい公開ID・eKYCやり直し）
 */
export async function deleteAccount(userId: string) {
  const check = await getAccountDeletionBlockers(userId);
  if (!check.canDelete) {
    throw new ApiError(409, check.blockers[0] ?? "いまは退会できません", "DELETE_BLOCKED");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "ユーザーが見つかりません", "NOT_FOUND");
  if (user.isSuspended && user.suspendReason === "deleted") {
    throw new ApiError(409, "すでに退会済みです", "ALREADY_DELETED");
  }

  const lineUserId =
    user.lineUserId ||
    (user.authProviderId?.startsWith("line:")
      ? user.authProviderId.slice("line:".length)
      : null);

  const stamp = Date.now().toString(36);
  await prisma.$transaction(async (db) => {
    await db.user.update({
      where: { id: userId },
      data: {
        isSuspended: true,
        suspendedAt: new Date(),
        suspendReason: "deleted",
        displayName: "退会済みユーザー",
        avatarUrl: null,
        email: `deleted_${stamp}_${userId}@serial-pay.local`,
        phoneE164: null,
        authProviderId: `deleted:${userId}:${stamp}`,
        stripeCustomerId: null,
      },
    });

    await db.auditLog.create({
      data: {
        actorUserId: userId,
        action: "ACCOUNT_DELETED",
        entityType: "User",
        entityId: userId,
        metadata: {
          lineUserId,
          rejoinCooldownDays: LINE_REJOIN_COOLDOWN_DAYS,
          resurrects: false,
        },
      },
    });
  });

  if (lineUserId) {
    await markLineIdentityDeleted({
      lineUserId,
      userId,
      disputeCountAsBuyer: user.disputeCountAsBuyer,
      disputeCountAsSeller: user.disputeCountAsSeller,
    });
  }

  return {
    deleted: true,
    rejoinCooldownDays: LINE_REJOIN_COOLDOWN_DAYS,
    resurrects: false,
  };
}
