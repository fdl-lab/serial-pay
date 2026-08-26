/**
 * 既存出品の artistName / eventName を平文→暗号化へ移行する。
 *
 *   npx tsx scripts/encrypt-event-meta.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  encryptEventMeta,
  looksLikeEventMetaCiphertext,
  normalizeEventMeta,
} from "../src/lib/crypto/event-meta";

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.item.findMany({
    select: { id: true, artistName: true, eventName: true },
  });

  let updated = 0;
  for (const row of rows) {
    const data: { artistName?: string | null; eventName?: string | null } = {};

    if (row.artistName && !looksLikeEventMetaCiphertext(row.artistName)) {
      const n = normalizeEventMeta(row.artistName);
      data.artistName = n ? encryptEventMeta(n) : null;
    }
    if (row.eventName && !looksLikeEventMetaCiphertext(row.eventName)) {
      const n = normalizeEventMeta(row.eventName);
      data.eventName = n ? encryptEventMeta(n) : null;
    }

    if (Object.keys(data).length === 0) continue;
    await prisma.item.update({ where: { id: row.id }, data });
    updated += 1;
  }

  console.log(`暗号化移行: ${updated} / ${rows.length} 件を更新`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
