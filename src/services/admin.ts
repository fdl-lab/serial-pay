import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import type { TransactionStatus } from "@prisma/client";

const OPEN_STATUSES = ["SUBMITTED", "UNDER_REVIEW"] as const;

/** 決済が成立した取引（取扱高集計対象） */
const VOLUME_STATUSES: TransactionStatus[] = [
  "PAID_ESCROW",
  "CONFIRMATION_WINDOW",
  "COMPLETED",
  "DISPUTED",
  "REFUNDED",
];

/** Asia/Tokyo の当日0時（UTC Date） */
function startOfTodayJst(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return new Date(`${y}-${m}-${d}T00:00:00+09:00`);
}

async function aggregateVolume(createdAtGte?: Date) {
  const where = {
    status: { in: VOLUME_STATUSES },
    // お試し（0円）・デモ出品の取引は取扱高から除外
    amountChargedYen: { gt: 0 },
    item: {
      unitPriceYen: { gt: 0 },
      AND: [
        { NOT: { title: { startsWith: "[お試し]" } } },
        { NOT: { title: { startsWith: "[デモ]" } } },
      ],
    },
    ...(createdAtGte ? { createdAt: { gte: createdAtGte } } : {}),
  };

  const [agg, count] = await Promise.all([
    prisma.transaction.aggregate({
      where,
      _sum: {
        amountChargedYen: true,
        platformFeeYen: true,
        subtotalYen: true,
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    count,
    amountChargedYen: agg._sum.amountChargedYen ?? 0,
    platformFeeYen: agg._sum.platformFeeYen ?? 0,
    subtotalYen: agg._sum.subtotalYen ?? 0,
  };
}

export async function getAdminTradeStats() {
  const todayStart = startOfTodayJst();
  /** 実ユーザー集計: LINE連携あり（シードのデモ購入者・出品者は除外） */
  const lineLinkedUser = {
    isSuspended: false as const,
    OR: [{ lineUserId: { not: null } }, { authProvider: "line" }],
  };

  const [
    today,
    allTime,
    lineTotal,
    lineActive,
    lineToday,
    usersTotal,
    usersActive,
    ekycApproved,
  ] = await Promise.all([
    aggregateVolume(todayStart),
    aggregateVolume(),
    prisma.lineIdentity.count(),
    prisma.lineIdentity.count({ where: { currentUserId: { not: null } } }),
    prisma.lineIdentity.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count(),
    prisma.user.count({ where: lineLinkedUser }),
    prisma.user.count({
      where: { ...lineLinkedUser, ekycStatus: "APPROVED" },
    }),
  ]);

  return {
    timezone: "Asia/Tokyo",
    todayStartsAt: todayStart.toISOString(),
    today,
    allTime,
    users: {
      lineTotal,
      lineActive,
      lineToday,
      usersTotal,
      usersActive,
      ekycApproved,
    },
  };
}

const REASON_LABEL: Record<string, string> = {
  CODE_INVALID: "コードが無効",
  CODE_ALREADY_USED: "使用済み",
  WRONG_CODE: "違うコード",
  OTHER: "その他",
};

export function disputeReasonLabel(reason: string) {
  return REASON_LABEL[reason] ?? reason;
}

export async function listOpenDisputes() {
  const rows = await prisma.dispute.findMany({
    where: { status: { in: [...OPEN_STATUSES] } },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      filer: {
        select: {
          id: true,
          publicId: true,
          displayName: true,
        },
      },
      transaction: {
        select: {
          id: true,
          amountChargedYen: true,
          stripePaidYen: true,
          walletPaidYen: true,
          quantity: true,
          status: true,
          item: {
            select: {
              id: true,
              title: true,
              artistName: true,
              eventName: true,
            },
          },
        },
      },
    },
  });

  return rows.map((d) => ({
    id: d.id,
    status: d.status,
    reason: d.reason,
    reasonLabel: disputeReasonLabel(d.reason),
    description: d.description,
    screenRecordingUrl: d.screenRecordingUrl,
    recordingDurationSec: d.recordingDurationSec,
    createdAt: d.createdAt.toISOString(),
    filer: d.filer,
    transaction: {
      id: d.transaction.id,
      amountChargedYen: d.transaction.amountChargedYen,
      stripePaidYen: d.transaction.stripePaidYen,
      walletPaidYen: d.transaction.walletPaidYen,
      quantity: d.transaction.quantity,
      status: d.transaction.status,
      item: d.transaction.item,
    },
  }));
}

export async function markDisputeUnderReview(disputeId: string) {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) throw new ApiError(404, "異議が見つかりません", "NOT_FOUND");
  if (dispute.status !== "SUBMITTED") return dispute;

  return prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status: "UNDER_REVIEW",
      reviewStartedAt: new Date(),
    },
  });
}
