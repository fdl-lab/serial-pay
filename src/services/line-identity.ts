import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";

/** 退会後、同じ LINE で再登録できない日数 */
export const LINE_REJOIN_COOLDOWN_DAYS = Number(
  process.env.LINE_REJOIN_COOLDOWN_DAYS ?? 30,
);

function addDays(from: Date, days: number) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function ensureLineIdentity(lineUserId: string) {
  return prisma.lineIdentity.upsert({
    where: { lineUserId },
    create: { lineUserId },
    update: {},
  });
}

/**
 * LINE ログイン可否。
 * - BAN → 永久不可
 * - 退会後クールダウン中の新規登録 → 不可（古いアカウントは復活しない）
 * - 有効な既存アカウントへのログイン → クールダウン対象外（BANのみ見る）
 */
export async function assertLineCanSignIn(
  lineUserId: string,
  opts: { allowActiveLogin: boolean },
) {
  const identity = await ensureLineIdentity(lineUserId);

  if (identity.bannedAt) {
    throw new ApiError(
      403,
      "このLINEアカウントは利用停止中です",
      "LINE_BANNED",
    );
  }

  if (!opts.allowActiveLogin && identity.lastDeletedAt) {
    const unlockAt = addDays(identity.lastDeletedAt, LINE_REJOIN_COOLDOWN_DAYS);
    if (unlockAt > new Date()) {
      const unlockLabel = unlockAt.toLocaleString("ja-JP");
      throw new ApiError(
        403,
        `退会後${LINE_REJOIN_COOLDOWN_DAYS}日間は同じLINEで再登録できません（解除目安: ${unlockLabel}）。古いアカウントは復活せず、期限後は新規アカウントになります`,
        "LINE_COOLDOWN",
      );
    }
  }

  return identity;
}

export async function linkLineIdentityToUser(lineUserId: string, userId: string) {
  await prisma.lineIdentity.upsert({
    where: { lineUserId },
    create: {
      lineUserId,
      currentUserId: userId,
    },
    update: {
      currentUserId: userId,
    },
  });
}

/** 退会時: クールダウン開始。アカウントは復活させず、期限後は新規作成 */
export async function markLineIdentityDeleted(opts: {
  lineUserId: string;
  userId: string;
  disputeCountAsBuyer: number;
  disputeCountAsSeller: number;
}) {
  const identity = await ensureLineIdentity(opts.lineUserId);
  await prisma.lineIdentity.update({
    where: { lineUserId: opts.lineUserId },
    data: {
      currentUserId: null,
      lastDeletedAt: new Date(),
      deleteCount: { increment: 1 },
      lifetimeDisputeAsBuyer: {
        set: Math.max(identity.lifetimeDisputeAsBuyer, opts.disputeCountAsBuyer),
      },
      lifetimeDisputeAsSeller: {
        set: Math.max(identity.lifetimeDisputeAsSeller, opts.disputeCountAsSeller),
      },
    },
  });
}

export async function banLineIdentity(lineUserId: string, reason: string) {
  await prisma.lineIdentity.upsert({
    where: { lineUserId },
    create: {
      lineUserId,
      bannedAt: new Date(),
      banReason: reason,
      currentUserId: null,
    },
    update: {
      bannedAt: new Date(),
      banReason: reason,
      currentUserId: null,
    },
  });
}
