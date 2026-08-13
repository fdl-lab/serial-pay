import { NextResponse } from "next/server";
import { requireUser, jsonError, ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { readLocalDisputeRecording } from "@/lib/storage/recording";

type Ctx = {
  params: Promise<{ buyerId: string; transactionId: string; filename: string }>;
};

export const runtime = "nodejs";

function mimeFromName(name: string) {
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".mov")) return "video/quicktime";
  return "video/mp4";
}

export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { buyerId, transactionId, filename } = await ctx.params;

    if (user.id !== buyerId) {
      const tx = await prisma.transaction.findUnique({
        where: { id: transactionId },
        select: { buyerId: true, sellerId: true },
      });
      if (!tx || (tx.buyerId !== user.id && tx.sellerId !== user.id)) {
        throw new ApiError(403, "閲覧権限がありません", "FORBIDDEN");
      }
    }

    const buf = await readLocalDisputeRecording(buyerId, transactionId, filename);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": mimeFromName(filename),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return jsonError(e);
  }
}
