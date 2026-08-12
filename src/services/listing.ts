import { ListingType, Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { encryptSerial, hashSerial } from "@/lib/crypto/serial";
import { ApiError, assertSellerEligible } from "@/lib/api";
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

export async function listPublicItems(params?: { take?: number; q?: string }) {
  const take = Math.min(params?.take ?? 50, 100);
  const q = params?.q?.trim();

  const rows = await prisma.item.findMany({
    where: {
      status: "ACTIVE",
      stockAvailable: { gt: 0 },
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { artistName: { contains: q, mode: "insensitive" } },
              { eventName: { contains: q, mode: "insensitive" } },
              { category: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
              { seller: { displayName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take,
    select: {
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
    },
  });

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

export function parseListingBody(raw: unknown): CreateListingInput {
  return listingSchema.parse(raw);
}

export type PublicItem = Prisma.ItemGetPayload<{
  include: { seller: { select: { id: true; displayName: true; ratingScore: true } } };
}>;
