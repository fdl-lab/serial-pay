import { prisma } from "@/lib/prisma";
import { ApiError, assertBuyerEligible } from "@/lib/api";
import type { User } from "@prisma/client";
import { isTrialListing } from "@/lib/trial-listing";
import { createUserMessage } from "@/services/messages";

const MAX_BODY = 500;

function mapAuthor(a: {
  id: string;
  publicId: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}) {
  return {
    id: a.id,
    publicId: a.publicId,
    displayName: a.displayName,
    avatarUrl: a.avatarUrl,
  };
}

export async function listListingComments(itemId: string) {
  const rows = await prisma.listingComment.findMany({
    where: { itemId, parentId: null },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: {
      author: {
        select: {
          id: true,
          publicId: true,
          displayName: true,
          avatarUrl: true,
        },
      },
      replies: {
        orderBy: { createdAt: "asc" },
        take: 50,
        include: {
          author: {
            select: {
              id: true,
              publicId: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      },
    },
  });

  return rows.map((c) => ({
    id: c.id,
    body: c.deletedAt ? null : c.body,
    deleted: Boolean(c.deletedAt),
    createdAt: c.createdAt,
    author: mapAuthor(c.author),
    replies: c.replies.map((r) => ({
      id: r.id,
      body: r.deletedAt ? null : r.body,
      deleted: Boolean(r.deletedAt),
      createdAt: r.createdAt,
      author: mapAuthor(r.author),
      parentId: r.parentId,
    })),
  }));
}

export async function createListingComment(
  user: User,
  itemId: string,
  bodyRaw: string,
  parentId?: string | null,
) {
  assertBuyerEligible(user);

  const body = bodyRaw.trim();
  if (!body) throw new ApiError(400, "コメントを入力してください", "EMPTY");
  if (body.length > MAX_BODY) {
    throw new ApiError(400, `コメントは${MAX_BODY}文字以内です`, "TOO_LONG");
  }

  const item = await prisma.item.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      title: true,
      status: true,
      sellerId: true,
      unitPriceYen: true,
    },
  });
  if (!item || item.status === "DRAFT") {
    throw new ApiError(404, "出品が見つかりません", "NOT_FOUND");
  }
  if (item.status === "ARCHIVED" || item.status === "SUSPENDED") {
    throw new ApiError(400, "この出品にはコメントできません", "CLOSED");
  }
  if (isTrialListing(item)) {
    throw new ApiError(400, "お試し出品にはコメントできません", "TRIAL");
  }

  let parentAuthorId: string | null = null;
  if (parentId) {
    const parent = await prisma.listingComment.findUnique({
      where: { id: parentId },
    });
    if (!parent || parent.itemId !== itemId || parent.deletedAt) {
      throw new ApiError(404, "返信先のコメントが見つかりません", "NOT_FOUND");
    }
    if (parent.parentId) {
      throw new ApiError(400, "返信への返信はできません", "NESTED");
    }
    parentAuthorId = parent.authorId;
  }

  const comment = await prisma.listingComment.create({
    data: {
      itemId,
      authorId: user.id,
      body,
      parentId: parentId || null,
    },
    include: {
      author: {
        select: {
          id: true,
          publicId: true,
          displayName: true,
          avatarUrl: true,
        },
      },
    },
  });

  const linkHref = `/items/${itemId}#comments`;
  const authorLabel = user.displayName?.trim() || "ユーザー";

  // 出品者へ通知（自分以外）
  if (item.sellerId !== user.id) {
    await createUserMessage({
      userId: item.sellerId,
      kind: "LISTING_COMMENT",
      title: parentId ? "出品に返信がありました" : "出品にコメントがありました",
      body: `「${item.title}」に ${authorLabel} さんからメッセージがあります。`,
      linkHref,
      linkLabel: "コメントを見る",
      relatedEntityType: "ListingComment",
      relatedEntityId: comment.id,
    });
  }

  // 親コメント作者へ通知（出品者以外・自分以外）
  if (
    parentAuthorId &&
    parentAuthorId !== user.id &&
    parentAuthorId !== item.sellerId
  ) {
    await createUserMessage({
      userId: parentAuthorId,
      kind: "LISTING_COMMENT_REPLY",
      title: "コメントに返信がありました",
      body: `「${item.title}」のコメントに ${authorLabel} さんから返信があります。`,
      linkHref,
      linkLabel: "返信を見る",
      relatedEntityType: "ListingComment",
      relatedEntityId: comment.id,
    });
  }

  return {
    id: comment.id,
    body: comment.body,
    deleted: false,
    createdAt: comment.createdAt,
    author: mapAuthor(comment.author),
    parentId: comment.parentId,
    replies: [] as never[],
  };
}

export async function softDeleteListingComment(user: User, commentId: string) {
  const comment = await prisma.listingComment.findUnique({
    where: { id: commentId },
    include: { item: { select: { sellerId: true } } },
  });
  if (!comment || comment.deletedAt) {
    throw new ApiError(404, "コメントが見つかりません", "NOT_FOUND");
  }
  const isAuthor = comment.authorId === user.id;
  const isSeller = comment.item.sellerId === user.id;
  if (!isAuthor && !isSeller) {
    throw new ApiError(403, "削除権限がありません", "FORBIDDEN");
  }

  await prisma.listingComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date(), body: "" },
  });

  return { ok: true };
}

/** マイページ: 自分の出品へのコメント + 自分が書いたコメント */
export async function listMyListingCommentInbox(userId: string) {
  const [onMyListings, authored] = await Promise.all([
    prisma.listingComment.findMany({
      where: {
        deletedAt: null,
        item: { sellerId: userId },
        NOT: { authorId: userId },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        item: { select: { id: true, title: true } },
        author: {
          select: {
            id: true,
            publicId: true,
            displayName: true,
          },
        },
      },
    }),
    prisma.listingComment.findMany({
      where: { authorId: userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        item: { select: { id: true, title: true } },
      },
    }),
  ]);

  return {
    onMyListings: onMyListings.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      parentId: c.parentId,
      item: c.item,
      author: c.author,
    })),
    authored: authored.map((c) => ({
      id: c.id,
      body: c.body,
      createdAt: c.createdAt,
      parentId: c.parentId,
      item: c.item,
    })),
  };
}
