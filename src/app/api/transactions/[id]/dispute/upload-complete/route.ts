import { z } from "zod";
import { jsonOk, jsonError, requireUser, ApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { completeDisputeRecordingUpload } from "@/lib/storage/recording";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  key: z.string().min(1),
  uploadId: z.string().min(1),
  mode: z.enum(["s3", "local"]).default("s3"),
  contentType: z.string().max(120).optional(),
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().positive(),
        etag: z.string().min(1),
      }),
    )
    .min(1),
});

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id: transactionId } = await ctx.params;

    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { buyerId: true },
    });
    if (!tx || tx.buyerId !== user.id) {
      throw new ApiError(404, "取引が見つかりません", "TX_NOT_FOUND");
    }

    const input = bodySchema.parse(await req.json());
    if (!input.key.startsWith(`disputes/${user.id}/${transactionId}/`)) {
      throw new ApiError(403, "不正なアップロード先です", "BAD_KEY");
    }

    const done = await completeDisputeRecordingUpload({
      key: input.key,
      uploadId: input.uploadId,
      parts: input.parts,
      mode: input.mode,
      contentType: input.contentType,
    });

    return jsonOk(done);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return jsonError(
        new ApiError(400, e.errors[0]?.message ?? "入力が不正です", "VALIDATION"),
      );
    }
    return jsonError(e);
  }
}
