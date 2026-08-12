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
