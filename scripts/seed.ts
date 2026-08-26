import { PrismaClient } from "@prisma/client";
import { createCipheriv, createHmac, randomBytes } from "crypto";
import { sealArtistAndEvent } from "../src/lib/crypto/event-meta";

const prisma = new PrismaClient();

function getKey(): Buffer {
  const raw = process.env.SERIAL_ENCRYPTION_KEY;
  if (!raw) throw new Error("SERIAL_ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("SERIAL_ENCRYPTION_KEY must be 32 bytes");
  return key;
}

function encryptSerial(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

function hashSerial(plaintext: string): string {
  const pepper = process.env.SERIAL_CODE_HASH_PEPPER;
  if (!pepper) throw new Error("SERIAL_CODE_HASH_PEPPER is not set");
  return createHmac("sha256", pepper).update(plaintext.trim().toUpperCase()).digest("hex");
}

async function main() {
  const buyer = await prisma.user.upsert({
    where: { email: "buyer@example.com" },
    update: {},
    create: {
      email: "buyer@example.com",
      displayName: "デモ購入者",
      publicId: "SP-BUYER001",
      profileCompletedAt: new Date(),
      phoneE164: "+819012345678",
      phoneVerified: true,
      ekycStatus: "APPROVED",
      ekycVerifiedAt: new Date(),
      ratingScore: 5,
    },
  });

  const seller = await prisma.user.upsert({
    where: { email: "seller@example.com" },
    update: {},
    create: {
      email: "seller@example.com",
      displayName: "デモ出品者",
      publicId: "SP-SELLER01",
      profileCompletedAt: new Date(),
      phoneE164: "+819087654321",
      phoneVerified: true,
      ekycStatus: "APPROVED",
      ekycVerifiedAt: new Date(),
      stripeConnectAccountId: process.env.SEED_CONNECT_ACCOUNT_ID ?? "acct_replace_me",
      stripeConnectStatus: "ACTIVE",
      ratingScore: 4.8,
      ratingCount: 12,
    },
  });

  await prisma.wallet.upsert({
    where: { userId: buyer.id },
    update: {},
    create: { userId: buyer.id, balanceYen: 3000, pendingYen: 0 },
  });

  await prisma.wallet.upsert({
    where: { userId: seller.id },
    update: {},
    create: { userId: seller.id, balanceYen: 0, pendingYen: 0 },
  });

  // market_stats へのシードは行わない（イベント別集計なし）

  const existingDemo = await prisma.item.count({
    where: { sellerId: seller.id, title: { startsWith: "[デモ]" } },
  });

  if (existingDemo > 0) {
    const sealedSample = sealArtistAndEvent({ artistName: "Sample Artists" });
    const sealedDelta = sealArtistAndEvent({ artistName: "△△" });
    await prisma.item.updateMany({
      where: { sellerId: seller.id, title: { startsWith: "[デモ] ○○" } },
      data: { artistName: sealedSample.artistName },
    });
    await prisma.item.updateMany({
      where: { sellerId: seller.id, title: { startsWith: "[デモ] ファンクラブ" } },
      data: { artistName: sealedSample.artistName },
    });
    await prisma.item.updateMany({
      where: { sellerId: seller.id, title: { startsWith: "[デモ] グッズ" } },
      data: { artistName: sealedDelta.artistName },
    });
    console.log("既存デモ出品にアーティスト名を補完したよ");
  }

  if (existingDemo === 0) {
    const demos = [
      {
        title: "[デモ] ○○ Live 2026 シリアル バラ売り",
        artistName: "Sample Artists",
        eventName: "○○ Live 2026",
        listingType: "INVENTORY" as const,
        unitPriceYen: 1200,
        codes: [
          "DEMO-LIVE-0001",
          "DEMO-LIVE-0002",
          "DEMO-LIVE-0003",
          "DEMO-LIVE-0004",
          "DEMO-LIVE-0005",
        ],
        bulk: true,
      },
      {
        title: "[デモ] ファンクラブ先行 セット5枚",
        artistName: "Sample Artists",
        eventName: "○○ Live 2026",
        listingType: "SET" as const,
        unitPriceYen: 1100,
        codes: [
          "DEMO-SET-A1",
          "DEMO-SET-A2",
          "DEMO-SET-A3",
          "DEMO-SET-A4",
          "DEMO-SET-A5",
        ],
        bulk: false,
      },
      {
        title: "[デモ] グッズ応募シリアル 在庫多め",
        artistName: "△△",
        eventName: "△△ Expo 2026",
        listingType: "INVENTORY" as const,
        unitPriceYen: 800,
        codes: Array.from(
          { length: 10 },
          (_, i) => `DEMO-GOODS-${String(i + 1).padStart(3, "0")}`,
        ),
        bulk: true,
      },
    ];

    for (const d of demos) {
      const stock = d.codes.length;
      const sealed = sealArtistAndEvent({
        artistName: d.artistName,
        eventName: d.eventName,
      });
      const item = await prisma.item.create({
        data: {
          sellerId: seller.id,
          title: d.title,
          artistName: sealed.artistName,
          eventName: sealed.eventName,
          listingType: d.listingType,
          status: "ACTIVE",
          unitPriceYen: d.unitPriceYen,
          setQuantity: d.listingType === "SET" ? stock : null,
          stockTotal: stock,
          stockAvailable: stock,
          bulkDiscountEnabled: d.bulk,
          bulkDiscountMinQty: d.bulk ? 3 : null,
          bulkDiscountPercent: d.bulk ? 10 : null,
          suggestedAvgPriceYen: null,
          publishedAt: new Date(),
        },
      });

      await prisma.serialCode.createMany({
        data: d.codes.map((code) => ({
          itemId: item.id,
          ciphertext: encryptSerial(code),
          codeHash: hashSerial(code),
          payloadKind: "TEXT" as const,
          status: "AVAILABLE" as const,
        })),
      });
    }
    console.log(`デモ出品を ${demos.length} 件つくったよ`);
  } else {
    console.log("デモ出品は既にあるのでスキップ");
  }

  // 0円お試し出品（購入フロー体験用）— 常に1件・在庫ありを確保
  const TRIAL_TITLE = "[お試し] 購入フロー体験シリアル";
  let trialItem = await prisma.item.findFirst({
    where: { sellerId: seller.id, title: TRIAL_TITLE },
  });

  if (!trialItem) {
    const trialSealed = sealArtistAndEvent({
      artistName: "シリアルPay",
      eventName: "はじめての購入体験",
    });
    trialItem = await prisma.item.create({
      data: {
        sellerId: seller.id,
        title: TRIAL_TITLE,
        artistName: trialSealed.artistName,
        eventName: trialSealed.eventName,
        category: "お試し",
        description:
          "カード不要・0円で、お支払いからシリアル開示までの流れを体験できます。",
        listingType: "INVENTORY",
        status: "ACTIVE",
        unitPriceYen: 0,
        stockTotal: 5,
        stockAvailable: 5,
        bulkDiscountEnabled: false,
        suggestedAvgPriceYen: null,
        publishedAt: new Date(),
      },
    });
    await prisma.serialCode.createMany({
      data: Array.from({ length: 5 }, (_, i) => {
        const code = `TRIAL-SEED-${String(i + 1).padStart(3, "0")}`;
        return {
          itemId: trialItem!.id,
          ciphertext: encryptSerial(code),
          codeHash: hashSerial(code),
          payloadKind: "TEXT" as const,
          status: "AVAILABLE" as const,
        };
      }),
    });
    console.log("0円お試し出品をつくったよ");
  } else {
    const available = await prisma.serialCode.count({
      where: { itemId: trialItem.id, status: "AVAILABLE" },
    });
    if (available < 3) {
      const need = 5 - available;
      await prisma.serialCode.createMany({
        data: Array.from({ length: need }, (_, i) => {
          const code = `TRIAL-SEED-${Date.now().toString(36).toUpperCase()}-${i}`;
          return {
            itemId: trialItem!.id,
            ciphertext: encryptSerial(code),
            codeHash: hashSerial(code),
            payloadKind: "TEXT" as const,
            status: "AVAILABLE" as const,
          };
        }),
      });
      await prisma.item.update({
        where: { id: trialItem.id },
        data: {
          unitPriceYen: 0,
          status: "ACTIVE",
          soldOutAt: null,
          stockTotal: { increment: need },
          stockAvailable: { increment: need },
          description:
            "カード不要・0円で、お支払いからシリアル開示までの流れを体験できます。",
          publishedAt: trialItem.publishedAt ?? new Date(),
        },
      });
      console.log(`お試し在庫を ${need} 枚補充したよ`);
    } else {
      await prisma.item.update({
        where: { id: trialItem.id },
        data: {
          unitPriceYen: 0,
          status: "ACTIVE",
          soldOutAt: null,
          description:
            "カード不要・0円で、お支払いからシリアル開示までの流れを体験できます。",
        },
      });
      console.log("0円お試し出品は既にあるよ（在庫OK）");
    }
  }

  console.log("Seed OK");
  console.log("DEV_USER_ID (buyer) =", buyer.id);
  console.log("SELLER_USER_ID      =", seller.id);
  console.log("buyer にはデモ残高 3,000円を入れてあるよ（ウォレット購入テスト用）");
  console.log("→ .env.local の DEV_USER_ID / NEXT_PUBLIC_DEV_USER_ID に buyer.id を入れてね");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
