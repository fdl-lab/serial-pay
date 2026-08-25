import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const item = await prisma.item.findFirst({
    where: { title: { startsWith: "[お試し]" } },
    select: { id: true, title: true, status: true, stockAvailable: true },
  });
  if (!item) {
    console.log("お試し出品が見つかりません");
    return;
  }
  const updated = await prisma.item.update({
    where: { id: item.id },
    data: { status: "ACTIVE", soldOutAt: null, unitPriceYen: 0 },
    select: { id: true, title: true, status: true, stockAvailable: true },
  });
  console.log("restored", updated);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
