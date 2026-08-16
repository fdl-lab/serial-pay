import { ListingType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { encryptSerial, hashSerial } from "@/lib/crypto/serial";
import { ApiError, assertSellerEligible } from "@/lib/api";
import { isTrialListing } from "@/lib/trial-listing";
import type { User } from "@prisma/client";

const listingSchema = z
  .object({
    title: z.string().min(1).max(120),
    description: z.string().max(5000).optional(),
    artistName: z.string().min(1).max(120),
    eventName: z.string().max(200).optional(),
    eventDate: z.string().datetime().optional().nullable(),
    category: z.string().max(80).optional(),
    listingType: z.enum(["SET", "INVENTORY"]),
    unitPriceYen: z.number().int().min(100).max(1_000_000),
    setQuantity: z.number().int().min(1).optional(),
    serialCodes: z.array(z.string().min(1).max(500)).min(1).max(500),
    bulkDiscountEnabled: z.boolean().optional().default(false),
    bulkDiscountMinQty: z.number().int().min(2).optional().nullable(),
    bulkDiscountPercent: z.number().int().min(1).max(50).optional().nullable(),
    confirmationWindowMinutes: z.number().int().min(15).max(60).optional(),
    publish: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.listingType === "SET") {
      if (!data.setQuantity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "セット販売では setQuantity が必須です",
          path: ["setQuantity"],
        });
      } else if (data.setQuantity !== data.serialCodes.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "セット枚数と登録コード数が一致しません",
          path: ["serialCodes"],
        });
      }
    }
    if (data.bulkDiscountEnabled) {
      if (!data.bulkDiscountMinQty || !data.bulkDiscountPercent) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "大口割引には最小枚数と割引率が必要です",
          path: ["bulkDiscountEnabled"],
        });
      }
    }
  });

export type CreateListingInput = z.infer<typeof listingSchema>;

export async function createListing(seller: User, raw: unknown) {
  assertSellerEligible(seller);

  const input = listingSchema.parse(raw);
  const hashes = input.serialCodes.map((c) => hashSerial(c));
  const unique = new Set(hashes);
  if (unique.size !== hashes.length) {
    throw new ApiError(400, "同一出品内で重複するシリアルがあります", "DUPLICATE_CODES");
  }

  const avg = await prisma.marketStat.findFirst({
    where: {
      eventName: input.eventName ?? "",
      windowDays: 14,
    },
  });

  const stockTotal = input.serialCodes.length;
  const setQuantity =
    input.listingType === "SET" ? input.setQuantity! : null;

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.item.create({
      data: {
        sellerId: seller.id,
        title: input.title,
        description: input.description,
        artistName: input.artistName,
        eventName: input.eventName,
        eventDate: input.eventDate ? new Date(input.eventDate) : null,
        category: input.category,
        listingType: input.listingType as ListingType,
        status: input.publish ? "ACTIVE" : "DRAFT",
        unitPriceYen: input.unitPriceYen,
        setQuantity,
        stockTotal,
        stockAvailable: stockTotal,
        bulkDiscountEnabled: input.bulkDiscountEnabled,
        bulkDiscountMinQty: input.bulkDiscountMinQty,
        bulkDiscountPercent: input.bulkDiscountPercent,
        suggestedAvgPriceYen: avg?.avgPriceYen ?? null,
        confirmationWindowMinutes: input.confirmationWindowMinutes ?? 30,
        publishedAt: input.publish ? new Date() : null,
      },
    });

    await tx.serialCode.createMany({
      data: input.serialCodes.map((code) => ({
        itemId: created.id,
        ciphertext: encryptSerial(code),
        codeHash: hashSerial(code),
        payloadKind: "TEXT",
        status: "AVAILABLE",
      })),
    });

    return created;
  });

  return {
    item: {
      id: item.id,
      title: item.title,
      listingType: item.listingType,
      unitPriceYen: item.unitPriceYen,
      stockAvailable: item.stockAvailable,
      setQuantity: item.setQuantity,
      status: item.status,
      suggestedAvgPriceYen: item.suggestedAvgPriceYen,
    },
  };
}

export async function getMarketHint(eventName?: string) {
  if (!eventName) return null;
  return prisma.marketStat.findFirst({
    where: { eventName, windowDays: 14 },
    orderBy: { updatedAt: "desc" },
  });
}

const publicItemSelect = {
  id: true,
  title: true,
  artistName: true,
  eventName: true,
  category: true,
  listingType: true,
  unitPriceYen: true,
  stockAvailable: true,
  setQuantity: true,
  bulkDiscountEnabled: true,
  bulkDiscountMinQty: true,
  bulkDiscountPercent: true,
  suggestedAvgPriceYen: true,
  publishedAt: true,
  seller: {
    select: {
      id: true,
      publicId: true,
      displayName: true,
      avatarUrl: true,
      ratingScore: true,
      ratingCount: true,
    },
  },
} as const;

function mapPublicItems(
  rows: Awaited<
    ReturnType<
      typeof prisma.item.findMany<{ select: typeof publicItemSelect }>
    >
  >,
) {
  // Prisma Decimal などをプレーンな値に直し、RSC / JSON のシリアライズ事故を防ぐ
  return rows.map((item) => ({
    id: item.id,
    title: item.title,
    artistName: item.artistName,
    eventName: item.eventName,
    category: item.category,
    listingType: item.listingType,
    unitPriceYen: item.unitPriceYen,
    stockAvailable: item.stockAvailable,
    setQuantity: item.setQuantity,
    bulkDiscountEnabled: item.bulkDiscountEnabled,
    bulkDiscountMinQty: item.bulkDiscountMinQty,
    bulkDiscountPercent: item.bulkDiscountPercent,
    suggestedAvgPriceYen: item.suggestedAvgPriceYen,
    publishedAt: item.publishedAt,
    seller: {
      id: item.seller.id,
      publicId: item.seller.publicId,
      displayName: item.seller.displayName,
      avatarUrl: item.seller.avatarUrl,
      ratingScore: Number(item.seller.ratingScore),
      ratingCount: item.seller.ratingCount,
    },
  }));
}

export async function listPublicItems(params?: { take?: number; q?: string }) {
  const take = Math.min(params?.take ?? 50, 100);
  const q = params?.q?.trim();

  // 検索時はお試し（0円）を除外
  if (q) {
    const rows = await prisma.item.findMany({
      where: {
        status: "ACTIVE",
        stockAvailable: { gt: 0 },
        unitPriceYen: { gt: 0 },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { artistName: { contains: q, mode: "insensitive" } },
          { eventName: { contains: q, mode: "insensitive" } },
          { category: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { seller: { displayName: { contains: q, mode: "insensitive" } } },
        ],
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take,
      select: publicItemSelect,
    });
    return mapPublicItems(rows);
  }

  // 通常一覧: お試しを先頭にピン留め（take 外に押し出されないよう別取得）
  const [trialRows, rows] = await Promise.all([
    prisma.item.findMany({
      where: {
        status: "ACTIVE",
        stockAvailable: { gt: 0 },
        unitPriceYen: 0,
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 5,
      select: publicItemSelect,
    }),
    prisma.item.findMany({
      where: {
        status: "ACTIVE",
        stockAvailable: { gt: 0 },
        unitPriceYen: { gt: 0 },
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take,
      select: publicItemSelect,
    }),
  ]);

  return [...mapPublicItems(trialRows), ...mapPublicItems(rows)];
}

export async function getPublicItem(id: string) {
  return prisma.item.findFirst({
    where: { id, status: { in: ["ACTIVE", "SOLD_OUT"] } },
    select: {
      id: true,
      title: true,
      description: true,
      artistName: true,
      eventName: true,
      eventDate: true,
      category: true,
      listingType: true,
      unitPriceYen: true,
      stockAvailable: true,
      stockTotal: true,
      setQuantity: true,
      bulkDiscountEnabled: true,
      bulkDiscountMinQty: true,
      bulkDiscountPercent: true,
      suggestedAvgPriceYen: true,
      confirmationWindowMinutes: true,
      status: true,
      publishedAt: true,
      seller: {
        select: {
          id: true,
          publicId: true,
          displayName: true,
          avatarUrl: true,
          ratingScore: true,
          ratingCount: true,
          completedSales: true,
        },
      },
    },
  });
}

const OPEN_TX_STATUSES = [
  "PENDING_PAYMENT",
  "PAID_ESCROW",
  "CONFIRMATION_WINDOW",
  "DISPUTED",
] as const;

export async function listSellerListings(sellerId: string) {
  const rows = await prisma.item.findMany({
    where: {
      sellerId,
      status: { in: ["DRAFT", "ACTIVE", "SOLD_OUT"] },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      artistName: true,
      eventName: true,
      listingType: true,
      unitPriceYen: true,
      stockAvailable: true,
      stockTotal: true,
      setQuantity: true,
      status: true,
      publishedAt: true,
      updatedAt: true,
      bulkDiscountEnabled: true,
      bulkDiscountMinQty: true,
      bulkDiscountPercent: true,
    },
  });

  return rows.map((item) => ({
    ...item,
    updatedAt: item.updatedAt.toISOString(),
    publishedAt: item.publishedAt?.toISOString() ?? null,
  }));
}

export async function getSellerListingForEdit(sellerId: string, itemId: string) {
  const item = await prisma.item.findFirst({
    where: {
      id: itemId,
      sellerId,
      status: { in: ["DRAFT", "ACTIVE", "SOLD_OUT"] },
    },
  });
  if (!item) {
    throw new ApiError(404, "出品が見つかりません", "ITEM_NOT_FOUND");
  }

  return {
    id: item.id,
    title: item.title,
    description: item.description,
    artistName: item.artistName,
    eventName: item.eventName,
    category: item.category,
    listingType: item.listingType,
    unitPriceYen: item.unitPriceYen,
    setQuantity: item.setQuantity,
    stockAvailable: item.stockAvailable,
    stockTotal: item.stockTotal,
    status: item.status,
    bulkDiscountEnabled: item.bulkDiscountEnabled,
    bulkDiscountMinQty: item.bulkDiscountMinQty,
    bulkDiscountPercent: item.bulkDiscountPercent,
    isTrial: isTrialListing(item),
  };
}

const updateListingSchema = z
  .object({
    title: z.string().min(1).max(120),
    description: z.string().max(5000).optional().nullable(),
    artistName: z.string().min(1).max(120),
    eventName: z.string().max(200).optional().nullable(),
    category: z.string().max(80).optional().nullable(),
    unitPriceYen: z.number().int().min(100).max(1_000_000),
    bulkDiscountEnabled: z.boolean().optional().default(false),
    bulkDiscountMinQty: z.number().int().min(2).optional().nullable(),
    bulkDiscountPercent: z.number().int().min(1).max(50).optional().nullable(),
    /** 在庫型のみ。既存コードは見せず、追加分だけ受け付ける */
    addSerialCodes: z.array(z.string().min(1).max(500)).max(500).optional(),
    publish: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.bulkDiscountEnabled) {
      if (!data.bulkDiscountMinQty || !data.bulkDiscountPercent) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "大口割引には最小枚数と割引率が必要です",
          path: ["bulkDiscountEnabled"],
        });
      }
    }
  });

export async function updateListing(
  seller: User,
  itemId: string,
  raw: unknown,
) {
  assertSellerEligible(seller);
  const input = updateListingSchema.parse(raw);

  const item = await prisma.item.findFirst({
    where: { id: itemId, sellerId: seller.id },
  });
  if (!item || item.status === "ARCHIVED" || item.status === "SUSPENDED") {
    throw new ApiError(404, "出品が見つかりません", "ITEM_NOT_FOUND");
  }
  if (isTrialListing(item)) {
    throw new ApiError(
      400,
      "お試し出品は編集できません",
      "TRIAL_LOCKED",
    );
  }

  const addCodes = (input.addSerialCodes ?? [])
    .map((c) => c.trim())
    .filter(Boolean);

  if (addCodes.length > 0 && item.listingType !== "INVENTORY") {
    throw new ApiError(
      400,
      "セット販売ではシリアルの追加はできません",
      "SET_NO_ADD",
    );
  }

  if (addCodes.length > 0) {
    const hashes = addCodes.map((c) => hashSerial(c));
    if (new Set(hashes).size !== hashes.length) {
      throw new ApiError(400, "追加コードに重複があります", "DUPLICATE_CODES");
    }
    const existing = await prisma.serialCode.findMany({
      where: { itemId, codeHash: { in: hashes } },
      select: { id: true },
    });
    if (existing.length > 0) {
      throw new ApiError(
        400,
        "すでに登録済みのシリアルが含まれています",
        "DUPLICATE_CODES",
      );
    }
  }

  const availableAfter = item.stockAvailable + addCodes.length;
  let nextStatus = item.status;
  if (input.publish === false) {
    nextStatus = "DRAFT";
  } else if (item.status === "DRAFT") {
    nextStatus = availableAfter > 0 ? "ACTIVE" : "DRAFT";
  } else if (availableAfter <= 0) {
    nextStatus = "SOLD_OUT";
  } else if (item.status === "SOLD_OUT" && availableAfter > 0) {
    nextStatus = "ACTIVE";
  } else {
    nextStatus = "ACTIVE";
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (addCodes.length > 0) {
      await tx.serialCode.createMany({
        data: addCodes.map((code) => ({
          itemId,
          ciphertext: encryptSerial(code),
          codeHash: hashSerial(code),
          payloadKind: "TEXT" as const,
          status: "AVAILABLE" as const,
        })),
      });
    }

    return tx.item.update({
      where: { id: itemId },
      data: {
        title: input.title,
        description: input.description ?? null,
        artistName: input.artistName,
        eventName: input.eventName || null,
        category: input.category || null,
        unitPriceYen: input.unitPriceYen,
        bulkDiscountEnabled: input.bulkDiscountEnabled,
        bulkDiscountMinQty: input.bulkDiscountEnabled
          ? input.bulkDiscountMinQty
          : null,
        bulkDiscountPercent: input.bulkDiscountEnabled
          ? input.bulkDiscountPercent
          : null,
        stockTotal: addCodes.length
          ? { increment: addCodes.length }
          : undefined,
        stockAvailable: addCodes.length
          ? { increment: addCodes.length }
          : undefined,
        status: nextStatus,
        soldOutAt: nextStatus === "SOLD_OUT" ? new Date() : null,
        publishedAt:
          nextStatus === "ACTIVE" && !item.publishedAt
            ? new Date()
            : item.publishedAt,
      },
    });
  });

  return {
    item: {
      id: updated.id,
      title: updated.title,
      unitPriceYen: updated.unitPriceYen,
      stockAvailable: updated.stockAvailable,
      status: updated.status,
    },
  };
}

export async function archiveListing(seller: User, itemId: string) {
  const item = await prisma.item.findFirst({
    where: { id: itemId, sellerId: seller.id },
  });
  if (!item) {
    throw new ApiError(404, "出品が見つかりません", "ITEM_NOT_FOUND");
  }
  if (item.status === "ARCHIVED") {
    return { itemId, alreadyArchived: true as const };
  }
  if (isTrialListing(item)) {
    throw new ApiError(400, "お試し出品は削除できません", "TRIAL_LOCKED");
  }

  const openCount = await prisma.transaction.count({
    where: {
      itemId,
      status: { in: [...OPEN_TX_STATUSES] },
    },
  });
  if (openCount > 0) {
    throw new ApiError(
      409,
      "進行中の取引があるため削除できません。取引の完了後に再度お試しください",
      "OPEN_TRANSACTIONS",
    );
  }

  await prisma.item.update({
    where: { id: itemId },
    data: { status: "ARCHIVED" },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: seller.id,
      action: "LISTING_ARCHIVED",
      entityType: "Item",
      entityId: itemId,
    },
  });

  return { itemId, alreadyArchived: false as const };
}

export function parseListingBody(raw: unknown): CreateListingInput {
  return listingSchema.parse(raw);
}

export type PublicItem = Prisma.ItemGetPayload<{
  include: { seller: { select: { id: true; displayName: true; ratingScore: true } } };
}>;
