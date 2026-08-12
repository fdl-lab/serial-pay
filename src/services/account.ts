import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import {
  LINE_REJOIN_COOLDOWN_DAYS,
  markLineIdentityDeleted,
} from "@/services/line-identity";

/** 退会を阻む未完了ステータス */
const OPEN_TX_STATUSES = [
  "PENDING_PAYMENT",
  "PAID_ESCROW",
  "CONFIRMATION_WINDOW",
  "DISPUTED",
] as const;

export async function countOpenTransactions(userId: string) {
  return prisma.transaction.count({
    where: {
      status: { in: [...OPEN_TX_STATUSES] },
      OR: [{ buyerId: userId }, { sellerId: userId }],
    },
  });
}

export async function getAccountDeletionBlockers(userId: string) {
  const openCount = await countOpenTransactions(userId);
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: { balanceYen: true, pendingYen: true },
  });

  const blockers: string[] = [];
  if (openCount > 0) {
    blockers.push(`未完了の取引が${openCount}件あるよ。完了・キャンセルしてから退会してね`);
  }
  if (wallet && wallet.pendingYen > 0) {
    blockers.push("出金申請中の残高があるよ。完了を待ってから退会してね");
  }

  return {
    canDelete: blockers.length === 0,
    blockers,
    openTransactionCount: openCount,
    walletBalanceYen: wallet?.balanceYen ?? 0,
    walletPendingYen: wallet?.pendingYen ?? 0,
    rejoinCooldownDays: LINE_REJOIN_COOLDOWN_DAYS,
  };
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
    throw new ApiError(409, check.blockers[0] ?? "いまは退会できないよ", "DELETE_BLOCKED");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "ユーザーが見つかりません", "NOT_FOUND");
  if (user.isSuspended && user.suspendReason === "deleted") {
    throw new ApiError(409, "すでに退会済みだよ", "ALREADY_DELETED");
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
        // lineUserId は監査のため残す
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
