import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getStripe, revealHoldHours } from "@/lib/stripe";
import { ApiError } from "@/lib/api";
import { creditWalletRefund } from "@/services/wallet";
import {
  createUserMessage,
  DISPUTE_REFUND_ETA_DAYS,
  markDisputeRejectedMessagesHandled,
} from "@/services/messages";
import { RECORDING_MAX_DURATION_SEC, deleteDisputeRecordingObject } from "@/lib/storage/recording";

/** 却下後の再申請猶予（日） */
const REAPPLY_WINDOW_DAYS = 7;

/** 審査終了後の画録保持日数（既定90日） */
export function disputeRecordingRetentionDays(): number {
  const raw = Number(process.env.DISPUTE_RECORDING_RETENTION_DAYS ?? "90");
  if (!Number.isFinite(raw) || raw < 7 || raw > 365) return 90;
  return Math.floor(raw);
}

const PURGED_RECORDING_URL = "(purged)";

const disputeSchema = z.object({
  reason: z.enum([
    "CODE_INVALID",
    "CODE_ALREADY_USED",
    "WRONG_CODE",
    "OTHER",
  ]),
  description: z.string().max(5000).optional(),
  /** 画録のアップロード済み URL（未添付は自動却下） */
  screenRecordingUrl: z.string().min(8).max(2000),
  screenRecordingKey: z.string().min(1).max(500),
  recordingDurationSec: z
    .number()
    .int()
    .min(5)
    .max(RECORDING_MAX_DURATION_SEC),
  /** 編集・AI加工なし・3分以内切り取りの確認 */
  attestUnedited: z.literal(true),
});

/** 異議ページ入場時: 確認タイマーを一時停止（ステータスは確認中のまま） */
export async function pauseConfirmationForDisputePage(
  buyerId: string,
  transactionId: string,
) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { dispute: { select: { status: true } } },
  });

  if (!tx || tx.buyerId !== buyerId) {
    throw new ApiError(404, "取引が見つかりません", "TX_NOT_FOUND");
  }
  if (tx.buyerConfirmedAt) {
    throw new ApiError(409, "受取確認済みのため異議は出せません", "ALREADY_CONFIRMED");
  }
  if (tx.status === "DISPUTED") {
    return {
      paused: true,
      alreadyPaused: true,
      remainingSec: tx.confirmationPausedRemainingSec ?? 0,
    };
  }
  if (tx.status !== "CONFIRMATION_WINDOW") {
    throw new ApiError(409, "異議申し立てできる期間ではありません", "INVALID_STATE");
  }

  // 却下後の再申請画面では止めない（止めたまま放置で確認中に固まるのを防ぐ）
  if (tx.dispute?.status === "REJECTED") {
    return {
      paused: false,
      skipped: true,
      remainingSec: tx.confirmationDeadlineAt
        ? Math.max(
            0,
            Math.ceil(
              (tx.confirmationDeadlineAt.getTime() - Date.now()) / 1000,
            ),
          )
        : (tx.confirmationPausedRemainingSec ?? 0),
    };
  }

  // すでに停止中ならそのまま
  if (
    !tx.confirmationDeadlineAt &&
    typeof tx.confirmationPausedRemainingSec === "number"
  ) {
    return {
      paused: true,
      alreadyPaused: true,
      remainingSec: tx.confirmationPausedRemainingSec,
    };
  }

  const now = new Date();
  if (!tx.confirmationDeadlineAt || tx.confirmationDeadlineAt < now) {
    throw new ApiError(
      400,
      "確認期限を過ぎたため異議申し立てできません",
      "DEADLINE_PASSED",
    );
  }

  const remainingSec = Math.max(
    0,
    Math.ceil((tx.confirmationDeadlineAt.getTime() - now.getTime()) / 1000),
  );

  await prisma.transaction.update({
    where: { id: transactionId },
    data: {
      confirmationDeadlineAt: null,
      confirmationPausedRemainingSec: remainingSec,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: buyerId,
      action: "CONFIRMATION_TIMER_PAUSED_FOR_DISPUTE",
      entityType: "Transaction",
      entityId: transactionId,
      metadata: { remainingSec },
    },
  });

  return { paused: true, alreadyPaused: false, remainingSec };
}

/**
 * 確認タイマーが「停止中のまま」固まった取引を直す。
 * 却下後の放置などは開示前（PAID_ESCROW）へ戻す。
 */
export async function healStuckConfirmationTimers(buyerId?: string) {
  const stuck = await prisma.transaction.findMany({
    where: {
      ...(buyerId ? { buyerId } : {}),
      status: "CONFIRMATION_WINDOW",
      buyerConfirmedAt: null,
      confirmationDeadlineAt: null,
      confirmationPausedRemainingSec: { not: null, gt: 0 },
    },
    include: {
      dispute: { select: { id: true, status: true } },
    },
    take: 50,
  });

  let resetToReveal = 0;
  let resumed = 0;

  for (const tx of stuck) {
    const disputeStatus = tx.dispute?.status ?? null;
    // 却下済み / 異議なしで止まっている → 開示前へ（申請せず終了と同じ）
    if (!disputeStatus || disputeStatus === "REJECTED") {
      await prisma.$transaction(async (db) => {
        await db.transaction.update({
          where: { id: tx.id },
          data: {
            status: "PAID_ESCROW",
            codeRevealedAt: null,
            confirmationDeadlineAt: null,
            confirmationPausedRemainingSec: null,
            buyerConfirmedAt: null,
          },
        });
        await db.serialCode.updateMany({
          where: { transactionId: tx.id },
          data: { status: "ASSIGNED" },
        });
      });
      resetToReveal += 1;
      continue;
    }

    // それ以外（稀）はタイマー再開
    const deadline = new Date(
      Date.now() + (tx.confirmationPausedRemainingSec ?? 0) * 1000,
    );
    await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        confirmationDeadlineAt: deadline,
        confirmationPausedRemainingSec: null,
      },
    });
    resumed += 1;
  }

  return { resetToReveal, resumed, scanned: stuck.length };
}

export async function createDispute(buyerId: string, transactionId: string, raw: unknown) {
  const input = disputeSchema.parse(raw);

  if (!input.screenRecordingUrl || !input.screenRecordingKey) {
    throw new ApiError(
      400,
      "画面録画の添付がない申請は自動却下されます",
      "RECORDING_REQUIRED",
    );
  }

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { item: { select: { title: true } } },
  });

  if (!tx || tx.buyerId !== buyerId) {
    throw new ApiError(404, "取引が見つかりません", "TX_NOT_FOUND");
  }
  if (tx.buyerConfirmedAt) {
    throw new ApiError(409, "受取確認済みのため異議は出せません", "ALREADY_CONFIRMED");
  }

  const existing = await prisma.dispute.findUnique({
    where: { transactionId },
  });

  const isReapply = existing?.status === "REJECTED";

  if (existing && !isReapply) {
    throw new ApiError(409, "既に異議申し立て済みです", "ALREADY_DISPUTED");
  }

  // 初回・再申請とも確認ウィンドウ中のみ
  if (tx.status !== "CONFIRMATION_WINDOW") {
    throw new ApiError(409, "異議申し立てできる期間ではありません", "INVALID_STATE");
  }

  const now = new Date();
  const alreadyPaused =
    !tx.confirmationDeadlineAt &&
    typeof tx.confirmationPausedRemainingSec === "number" &&
    tx.confirmationPausedRemainingSec > 0;
  const withinWindow =
    alreadyPaused ||
    (!!tx.confirmationDeadlineAt && tx.confirmationDeadlineAt >= now);

  if (!withinWindow) {
    throw new ApiError(
      400,
      "確認期限を過ぎたため異議申し立てできません",
      "DEADLINE_PASSED",
    );
  }

  // 異議中は確認タイマーを停止（ページ入場で止まっていればその残りを維持）
  const pausedRemainingSec = alreadyPaused
    ? Math.max(0, tx.confirmationPausedRemainingSec!)
    : Math.max(
        0,
        Math.ceil((tx.confirmationDeadlineAt!.getTime() - now.getTime()) / 1000),
      );

  const oldRecordingKey = isReapply ? existing?.screenRecordingKey ?? null : null;

  const dispute = await prisma.$transaction(async (db) => {
    const d = isReapply
      ? await db.dispute.update({
          where: { id: existing!.id },
          data: {
            reason: input.reason,
            description: input.description,
            screenRecordingUrl: input.screenRecordingUrl,
            screenRecordingKey: input.screenRecordingKey,
            recordingDurationSec: input.recordingDurationSec,
            recordingUploadedAt: now,
            status: "SUBMITTED",
            filedWithinWindow: true,
            reviewedAt: null,
            reviewerNote: null,
            reviewStartedAt: null,
          },
        })
      : await db.dispute.create({
          data: {
            transactionId,
            filerId: buyerId,
            reason: input.reason,
            description: input.description,
            screenRecordingUrl: input.screenRecordingUrl,
            screenRecordingKey: input.screenRecordingKey,
            recordingDurationSec: input.recordingDurationSec,
            status: "SUBMITTED",
            filedWithinWindow: true,
          },
        });

    await db.transaction.update({
      where: { id: transactionId },
      data: {
        status: "DISPUTED",
        confirmationDeadlineAt: null,
        confirmationPausedRemainingSec: pausedRemainingSec,
      },
    });

    await db.serialCode.updateMany({
      where: { transactionId },
      data: { status: "DISPUTED" },
    });

    if (!isReapply) {
      // 「出した」は申請時点。「受けた」は許可時に加算する
      await db.user.update({
        where: { id: buyerId },
        data: { disputeCountAsBuyer: { increment: 1 } },
      });
    }

    await db.auditLog.create({
      data: {
        actorUserId: buyerId,
        action: isReapply ? "DISPUTE_REAPPLIED" : "DISPUTE_SUBMITTED",
        entityType: "Dispute",
        entityId: d.id,
        metadata: {
          reason: input.reason,
          recordingDurationSec: input.recordingDurationSec,
          attestUnedited: true,
        },
      },
    });

    return d;
  });

  // 再申請で差し替えた旧画録はストレージから削除（best-effort）
  if (
    oldRecordingKey &&
    oldRecordingKey !== input.screenRecordingKey
  ) {
    void deleteDisputeRecordingObject(oldRecordingKey).catch(() => undefined);
  }

  const itemLabel = tx.item.title;
  if (isReapply) {
    await markDisputeRejectedMessagesHandled(buyerId, transactionId);
  }
  await createUserMessage({
    userId: buyerId,
    kind: isReapply ? "DISPUTE_REAPPLIED" : "DISPUTE_SUBMITTED",
    title: isReapply ? "異議を再申請しました" : "異議申し立てを受け付けました",
    body: [
      `「${itemLabel}」の異議を事務局が確認します。`,
      "審査中は確認タイマーを停止しています。",
      `許可された場合、事務局確認後およそ1〜2週間（目安${DISPUTE_REFUND_ETA_DAYS}日以内）でウォレット残高へ返金されます。`,
      "審査にはお時間をいただくことがあります。結果はマイページのメッセージでお知らせします。",
    ].join("\n"),
    linkHref: `/transactions/${transactionId}`,
    linkLabel: "取引を見る",
    relatedEntityType: "Dispute",
    relatedEntityId: dispute.id,
  });

  await createUserMessage({
    userId: tx.sellerId,
    kind: isReapply ? "DISPUTE_REAPPLIED_SELLER" : "DISPUTE_SUBMITTED_SELLER",
    title: isReapply
      ? "あなたの出品に異議が再申請されました"
      : "あなたの出品に異議申し立てがありました",
    body: [
      `「${itemLabel}」の取引について、購入者から異議申し立てがありました。`,
      "事務局が内容を確認します。審査中は売上の確定が保留されます。",
      "結果はマイページのお知らせで連絡します。対応完了までしばらくお待ちください。",
    ].join("\n"),
    linkHref: "/me",
    linkLabel: "マイページを見る",
    relatedEntityType: "Dispute",
    relatedEntityId: dispute.id,
  });

  return { disputeId: dispute.id, status: dispute.status, reapplied: isReapply };
}

/**
 * 異議ページ用: 再申請可否などの状態
 */
export async function getDisputePageState(buyerId: string, transactionId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      dispute: {
        select: {
          id: true,
          status: true,
          reviewedAt: true,
          reviewerNote: true,
        },
      },
      item: { select: { title: true } },
    },
  });

  if (!tx || tx.buyerId !== buyerId) {
    throw new ApiError(404, "取引が見つかりません", "TX_NOT_FOUND");
  }

  const canReapply =
    tx.status === "CONFIRMATION_WINDOW" &&
    !tx.buyerConfirmedAt &&
    tx.dispute?.status === "REJECTED";

  const canFileNew =
    tx.status === "CONFIRMATION_WINDOW" &&
    !tx.buyerConfirmedAt &&
    !tx.dispute;

  return {
    transactionId: tx.id,
    itemTitle: tx.item.title,
    transactionStatus: tx.status,
    disputeStatus: tx.dispute?.status ?? null,
    reviewerNote: tx.dispute?.reviewerNote ?? null,
    canReapply,
    canFileNew,
    confirmationDeadlineAt: tx.confirmationDeadlineAt,
    confirmationPausedRemainingSec: tx.confirmationPausedRemainingSec,
  };
}

/**
 * 却下後の再申請をやめて、開示前（PAID_ESCROW）に戻す。
 * 再度開示すると確認タイマー（既定60分）が新たに始まる。
 * 開示期限は終了操作時点から既定72時間で付け直す。
 */
export async function abandonDisputeReapply(
  buyerId: string,
  transactionId: string,
) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      dispute: { select: { id: true, status: true } },
      item: { select: { title: true } },
    },
  });

  if (!tx || tx.buyerId !== buyerId) {
    throw new ApiError(404, "取引が見つかりません", "TX_NOT_FOUND");
  }
  if (tx.status !== "CONFIRMATION_WINDOW") {
    throw new ApiError(409, "いまはこの操作ができません", "INVALID_STATE");
  }
  if (tx.buyerConfirmedAt) {
    throw new ApiError(409, "すでに受取確認済みです", "ALREADY_CONFIRMED");
  }
  // 審査中・許可済みなどは終了不可。却下済み or 異議なしなら開示前へ戻せる
  if (tx.dispute && tx.dispute.status !== "REJECTED") {
    throw new ApiError(
      409,
      "異議の審査中は終了できません",
      "DISPUTE_IN_PROGRESS",
    );
  }

  const now = new Date();
  const revealDeadlineAt = new Date(
    now.getTime() + revealHoldHours() * 60 * 60_000,
  );

  await prisma.$transaction(async (db) => {
    await db.transaction.update({
      where: { id: tx.id },
      data: {
        status: "PAID_ESCROW",
        codeRevealedAt: null,
        confirmationDeadlineAt: null,
        confirmationPausedRemainingSec: null,
        buyerConfirmedAt: null,
        revealDeadlineAt,
      },
    });

    await db.serialCode.updateMany({
      where: { transactionId: tx.id },
      data: { status: "ASSIGNED" },
    });

    if (tx.dispute) {
      await db.auditLog.create({
        data: {
          actorUserId: buyerId,
          action: "DISPUTE_REAPPLY_ABANDONED",
          entityType: "Dispute",
          entityId: tx.dispute.id,
          metadata: {
            transactionId: tx.id,
            resetTo: "PAID_ESCROW",
            revealDeadlineAt: revealDeadlineAt.toISOString(),
          },
        },
      });
    }
  });

  await markDisputeRejectedMessagesHandled(buyerId, tx.id);

  return {
    abandoned: true,
    transactionId: tx.id,
    status: "PAID_ESCROW" as const,
    revealDeadlineAt,
    redirectTo: `/transactions/${tx.id}`,
  };
}

/**
 * 運営審査結果の適用（管理API想定）
 */
export async function resolveDispute(
  disputeId: string,
  decision: "APPROVED_REFUND" | "REJECTED",
  reviewerNote?: string,
) {
  const dispute = await prisma.dispute.findUnique({
    where: { id: disputeId },
    include: {
      transaction: {
        include: { item: { select: { title: true } } },
      },
    },
  });
  if (!dispute) throw new ApiError(404, "異議が見つかりません", "NOT_FOUND");
  if (!["SUBMITTED", "UNDER_REVIEW"].includes(dispute.status)) {
    throw new ApiError(409, "審査できない状態です", "INVALID_STATE");
  }

  const itemLabel = dispute.transaction.item.title;
  const tx = dispute.transaction;

  if (decision === "APPROVED_REFUND") {
    let refundId: string | null = null;

    if (tx.stripePaidYen > 0) {
      if (!tx.stripePaymentIntentId) {
        throw new ApiError(400, "PaymentIntent がありません", "NO_PI");
      }
      const stripe = getStripe();
      const refund = await stripe.refunds.create({
        payment_intent: tx.stripePaymentIntentId,
        amount: tx.stripePaidYen,
        metadata: { disputeId, transactionId: tx.id },
      });
      refundId = refund.id;
    }

    await prisma.$transaction(async (db) => {
      if (tx.walletPaidYen > 0) {
        await creditWalletRefund(db, {
          buyerId: tx.buyerId,
          amountYen: tx.walletPaidYen,
          transactionId: tx.id,
          description: "異議許可による残高返金",
        });
      }

      await db.dispute.update({
        where: { id: disputeId },
        data: {
          status: "APPROVED_REFUND",
          reviewedAt: new Date(),
          reviewerNote,
        },
      });
      await db.transaction.update({
        where: { id: tx.id },
        data: {
          status: "REFUNDED",
          escrowStatus: "REFUNDED",
          stripeRefundId: refundId,
        },
      });
      await db.serialCode.updateMany({
        where: { transactionId: tx.id },
        data: { status: "INVALID" },
      });

      // 出品者の「異議を受けた回数」は許可されたときだけ加算
      await db.user.update({
        where: { id: tx.sellerId },
        data: { disputeCountAsSeller: { increment: 1 } },
      });
    });

    await createUserMessage({
      userId: tx.buyerId,
      kind: "DISPUTE_APPROVED",
      title: "異議が許可されました",
      body: [
        `「${itemLabel}」の異議申し立てが許可されました。`,
        `ウォレット残高への返金は${DISPUTE_REFUND_ETA_DAYS}日以内を目安に反映されます（事務局確認後およそ1〜2週間）。`,
        reviewerNote ? `事務局メモ: ${reviewerNote}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      linkHref: "/me",
      linkLabel: "マイページを見る",
      relatedEntityType: "Dispute",
      relatedEntityId: disputeId,
    });

    await createUserMessage({
      userId: tx.sellerId,
      kind: "DISPUTE_APPROVED_SELLER",
      title: "異議が許可され、返金になりました",
      body: [
        `「${itemLabel}」の取引について、購入者の異議申し立てが許可されました。`,
        "この取引の売上は確定せず、購入者へ返金されます。",
        reviewerNote ? `事務局メモ: ${reviewerNote}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      linkHref: "/me",
      linkLabel: "マイページを見る",
      relatedEntityType: "Dispute",
      relatedEntityId: disputeId,
    });

    return { disputeId, decision, refundId };
  }

  // 却下 → 止めていたタイマーを再開。再申請猶予（7日）未満ならそちらまで延長
  const nowReject = new Date();
  const resumedFromPause = new Date(
    nowReject.getTime() +
      Math.max(0, tx.confirmationPausedRemainingSec ?? 0) * 1000,
  );
  const reapplyDeadline = new Date(
    nowReject.getTime() + REAPPLY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  const deadline =
    resumedFromPause > reapplyDeadline ? resumedFromPause : reapplyDeadline;

  await prisma.$transaction(async (db) => {
    await db.dispute.update({
      where: { id: disputeId },
      data: {
        status: "REJECTED",
        reviewedAt: new Date(),
        reviewerNote,
      },
    });

    await db.transaction.update({
      where: { id: dispute.transactionId },
      data: {
        status: "CONFIRMATION_WINDOW",
        confirmationDeadlineAt: deadline,
        confirmationPausedRemainingSec: null,
      },
    });

    await db.serialCode.updateMany({
      where: { transactionId: dispute.transactionId },
      data: { status: "ASSIGNED" },
    });
  });

  await createUserMessage({
    userId: tx.buyerId,
    kind: "DISPUTE_REJECTED",
    title: "異議が却下されました",
    body: [
      `「${itemLabel}」の異議申し立ては却下されました。`,
      "必要事項を追記のうえ再申請するか、申請せずに開示前へ戻ることもできます。",
      `期限は ${deadline.toLocaleString("ja-JP")} までです。`,
      reviewerNote ? `事務局メモ: ${reviewerNote}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    linkHref: `/transactions/${tx.id}/dispute`,
    linkLabel: "再申請する",
    relatedEntityType: "Transaction",
    relatedEntityId: tx.id,
  });

  await createUserMessage({
    userId: tx.sellerId,
    kind: "DISPUTE_REJECTED_SELLER",
    title: "異議が却下されました",
    body: [
      `「${itemLabel}」の取引について、購入者の異議申し立ては却下されました。`,
      "購入者が再申請する場合があります。審査結果は改めてお知らせします。",
      reviewerNote ? `事務局メモ: ${reviewerNote}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    linkHref: "/me",
    linkLabel: "マイページを見る",
    relatedEntityType: "Dispute",
    relatedEntityId: disputeId,
  });

  return { disputeId, decision, reapplyDeadline: deadline };
}

/**
 * 審査終了から一定日数経過した異議画録をストレージから削除し、DB参照をクリアする。
 * 対象: APPROVED_REFUND / REJECTED（reviewedAt 基準）
 */
export async function purgeExpiredDisputeRecordings(take = 40) {
  const retentionDays = disputeRecordingRetentionDays();
  const cutoff = new Date(
    Date.now() - retentionDays * 24 * 60 * 60 * 1000,
  );

  const rows = await prisma.dispute.findMany({
    where: {
      status: { in: ["APPROVED_REFUND", "REJECTED"] },
      reviewedAt: { lte: cutoff },
      screenRecordingKey: { not: null },
      NOT: { screenRecordingUrl: PURGED_RECORDING_URL },
    },
    select: {
      id: true,
      screenRecordingKey: true,
      screenRecordingUrl: true,
      status: true,
      reviewedAt: true,
    },
    orderBy: { reviewedAt: "asc" },
    take: Math.min(take, 100),
  });

  const results: {
    id: string;
    ok: boolean;
    deletedObject: boolean;
    error?: string;
  }[] = [];

  for (const row of rows) {
    try {
      const del = await deleteDisputeRecordingObject(row.screenRecordingKey);
      await prisma.dispute.update({
        where: { id: row.id },
        data: {
          screenRecordingUrl: PURGED_RECORDING_URL,
          screenRecordingKey: null,
        },
      });
      await prisma.auditLog.create({
        data: {
          actorUserId: null,
          action: "DISPUTE_RECORDING_PURGED",
          entityType: "Dispute",
          entityId: row.id,
          metadata: {
            retentionDays,
            reviewedAt: row.reviewedAt,
            status: row.status,
            deletedObject: del.deleted,
            deleteReason: del.reason,
            previousKey: row.screenRecordingKey,
          },
        },
      });
      results.push({
        id: row.id,
        ok: true,
        deletedObject: del.deleted,
      });
    } catch (e) {
      results.push({
        id: row.id,
        ok: false,
        deletedObject: false,
        error: e instanceof Error ? e.message : "unknown",
      });
    }
  }

  return {
    retentionDays,
    cutoff,
    scanned: rows.length,
    purged: results.filter((r) => r.ok).length,
    results,
  };
}
