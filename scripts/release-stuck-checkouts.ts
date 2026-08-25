import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const txIds = ["cmt3udxpq0001l104clp108z3", "cmt3udinz0001jx04n0ikqta0"];
  for (const transactionId of txIds) {
    const tx = await p.transaction.findUnique({ where: { id: transactionId } });
    if (!tx || tx.status !== "PENDING_PAYMENT") {
      console.log(transactionId, "skip", tx?.status);
      continue;
    }
    await p.$transaction(async (db) => {
      const reserved = await db.serialCode.findMany({
        where: { transactionId: tx.id, status: "RESERVED" },
        select: { id: true },
      });
      if (reserved.length > 0) {
        await db.serialCode.updateMany({
          where: { id: { in: reserved.map((c) => c.id) } },
          data: {
            status: "AVAILABLE",
            reservedAt: null,
            reservedUntil: null,
            transactionId: null,
          },
        });
        await db.item.update({
          where: { id: tx.itemId },
          data: {
            stockAvailable: { increment: reserved.length },
            status: "ACTIVE",
            soldOutAt: null,
          },
        });
      }
      await db.transaction.update({
        where: { id: tx.id },
        data: { status: "CANCELLED", escrowStatus: "NONE" },
      });
      console.log(
        "released",
        transactionId,
        "codes",
        reserved.length,
        "item",
        tx.itemId,
      );
    });
  }
  for (const id of ["cmt3u4rzu0005jx04aedzu0is", "cmt3u3smg0001jx04h6mfss5g"]) {
    const item = await p.item.findUnique({
      where: { id },
      select: {
        title: true,
        stockAvailable: true,
        stockTotal: true,
        status: true,
      },
    });
    console.log("item", id, item);
  }
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
