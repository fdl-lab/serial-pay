import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const items = await prisma.item.findMany({
    where: {
      OR: [
        { title: { startsWith: "[デモ]" } },
        { title: { startsWith: "[お試し]" } },
        {
          seller: {
            email: { in: ["seller@example.com", "buyer@example.com"] },
          },
        },
        {
          seller: {
            displayName: { in: ["デモ出品者", "デモ購入者"] },
          },
        },
      ],
      status: { not: "ARCHIVED" },
    },
    select: {
      id: true,
      title: true,
      status: true,
      unitPriceYen: true,
      seller: { select: { displayName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  console.log(`対象 ${items.length} 件`);
  for (const item of items) {
    console.log(
      `- [${item.status}] ${item.title} / ${item.seller.displayName} / ¥${item.unitPriceYen}`,
    );
  }

  if (dryRun) {
    console.log("dry-run のため更新しません");
    return;
  }

  if (items.length === 0) return;

  const result = await prisma.item.updateMany({
    where: { id: { in: items.map((i) => i.id) } },
    data: { status: "ARCHIVED" },
  });
  console.log(`ARCHIVED に更新: ${result.count} 件`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
