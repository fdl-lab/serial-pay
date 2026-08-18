import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";

const OPEN_STATUSES = ["SUBMITTED", "UNDER_REVIEW"] as const;

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
