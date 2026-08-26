import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api";
import { openArtistAndEvent } from "@/lib/crypto/event-meta";

export async function listFavorites(userId: string) {
  const rows = await prisma.favorite.findMany({
    where: {
      userId,
      item: { status: { in: ["ACTIVE", "SOLD_OUT"] } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      item: {
        select: {
          id: true,
          title: true,
          artistName: true,
          eventName: true,
          unitPriceYen: true,
          status: true,
          stockAvailable: true,
          listingType: true,
          setQuantity: true,
        },
      },
    },
  });

  return rows.map((r) => ({
    itemId: r.itemId,
    createdAt: r.createdAt,
    item: openArtistAndEvent(r.item),
  }));
}

export async function isFavorited(userId: string, itemId: string) {
  const row = await prisma.favorite.findUnique({
    where: { userId_itemId: { userId, itemId } },
    select: { userId: true },
  });
  return Boolean(row);
}

export async function addFavorite(userId: string, itemId: string) {
  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item || item.status === "ARCHIVED" || item.status === "DRAFT") {
    throw new ApiError(404, "出品が見つかりません", "NOT_FOUND");
  }
  if (item.sellerId === userId) {
    throw new ApiError(400, "自分の出品はお気に入りできません", "OWN_ITEM");
  }

  await prisma.favorite.upsert({
    where: { userId_itemId: { userId, itemId } },
    create: { userId, itemId },
    update: {},
  });

  return { favorited: true };
}

export async function removeFavorite(userId: string, itemId: string) {
  await prisma.favorite.deleteMany({ where: { userId, itemId } });
  return { favorited: false };
}
