import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";

export const DISPUTE_REFUND_ETA_DAYS = 14;

export async function createUserMessage(params: {
  userId: string;
  kind: string;
  title: string;
  body: string;
  linkHref?: string | null;
  linkLabel?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}) {
  return prisma.userMessage.create({
    data: {
      userId: params.userId,
      kind: params.kind,
      title: params.title,
      body: params.body,
      linkHref: params.linkHref ?? null,
      linkLabel: params.linkLabel ?? null,
      relatedEntityType: params.relatedEntityType ?? null,
      relatedEntityId: params.relatedEntityId ?? null,
    },
  });
}

export async function listUserMessages(userId: string, take = 30) {
  await syncHandledDisputeRejectedMessages(userId);

  const rows = await prisma.userMessage.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });

  return rows.map((m) => ({
    id: m.id,
    kind: m.kind,
    title: m.title,
    body: m.body,
    linkHref: m.linkHref,
    linkLabel: m.linkLabel,
    relatedEntityType: m.relatedEntityType,
    relatedEntityId: m.relatedEntityId,
    createdAt: m.createdAt,
    readAt: m.readAt,
    unread: !m.readAt,
  }));
}

function transactionIdFromMessageRow(m: {
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  linkHref: string | null;
}): string | null {
  if (m.relatedEntityType === "Transaction" && m.relatedEntityId) {
    return m.relatedEntityId;
  }
  const href = m.linkHref ?? "";
  const match = href.match(/^\/transactions\/([^/]+)/);
  return match?.[1] ?? null;
}

/**
 * すでに対応済みなのに DISPUTE_REJECTED のまま残っているお知らせを直す。
 * （終了・再申請後もボタンが出続けるのを防ぐ）
 */
async function syncHandledDisputeRejectedMessages(userId: string) {
  const pending = await prisma.userMessage.findMany({
    where: { userId, kind: "DISPUTE_REJECTED" },
    select: {
      id: true,
      relatedEntityType: true,
      relatedEntityId: true,
      linkHref: true,
    },
    take: 50,
  });
  if (pending.length === 0) return;

  const txIds = [
    ...new Set(
      pending
        .map((m) => transactionIdFromMessageRow(m))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (txIds.length === 0) return;

  const txs = await prisma.transaction.findMany({
    where: { id: { in: txIds }, buyerId: userId },
    select: {
      id: true,
      status: true,
      buyerConfirmedAt: true,
      dispute: { select: { status: true } },
    },
  });
  const byId = new Map(txs.map((t) => [t.id, t]));

  for (const m of pending) {
    const txId = transactionIdFromMessageRow(m);
    if (!txId) continue;
    const tx = byId.get(txId);
    if (!tx) continue;

    // まだ「再申請 or 終了」できる状態なら触らない
    const stillActionable =
      tx.status === "CONFIRMATION_WINDOW" &&
      !tx.buyerConfirmedAt &&
      tx.dispute?.status === "REJECTED";
    if (stillActionable) continue;

    await markDisputeRejectedMessagesHandled(userId, txId);
  }
}

/**
 * 異議却下のお知らせを「対応済み」にする（再申請 / 申請せず終了）。
 * kind を DISPUTE_REJECTED_HANDLED に変え、既読化する。
 */
export async function markDisputeRejectedMessagesHandled(
  userId: string,
  transactionId: string,
) {
  const now = new Date();
  const disputePath = `/transactions/${transactionId}/dispute`;
  const txPath = `/transactions/${transactionId}`;

  await prisma.userMessage.updateMany({
    where: {
      userId,
      kind: "DISPUTE_REJECTED",
      OR: [
        {
          relatedEntityType: "Transaction",
          relatedEntityId: transactionId,
        },
        { linkHref: disputePath },
        { linkHref: txPath },
        { linkHref: { startsWith: `${txPath}/` } },
      ],
    },
    data: {
      kind: "DISPUTE_REJECTED_HANDLED",
      readAt: now,
      linkHref: txPath,
      linkLabel: "取引を見る",
    },
  });
}

export async function markMessageRead(userId: string, messageId: string) {
  const msg = await prisma.userMessage.findUnique({ where: { id: messageId } });
  if (!msg || msg.userId !== userId) {
    throw new ApiError(404, "メッセージが見つかりません", "NOT_FOUND");
  }
  if (msg.readAt) return msg;
  return prisma.userMessage.update({
    where: { id: messageId },
    data: { readAt: new Date() },
  });
}

export async function markAllMessagesRead(userId: string) {
  await prisma.userMessage.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function countUnreadMessages(userId: string) {
  return prisma.userMessage.count({
    where: { userId, readAt: null },
  });
}

export async function sendAdminMessage(params: {
  userId: string;
  title: string;
  body: string;
  linkHref?: string | null;
  linkLabel?: string | null;
}) {
  return createUserMessage({
    userId: params.userId,
    kind: "ADMIN_NOTICE",
    title: params.title,
    body: params.body,
    linkHref: params.linkHref,
    linkLabel: params.linkLabel,
    relatedEntityType: "Admin",
    relatedEntityId: null,
  });
}

export async function findUserForAdminMessage(query: string) {
  const q = query.trim();
  if (!q) return null;
  return prisma.user.findFirst({
    where: {
      OR: [{ id: q }, { publicId: q }, { email: q }],
    },
    select: {
      id: true,
      publicId: true,
      displayName: true,
      email: true,
    },
  });
}
