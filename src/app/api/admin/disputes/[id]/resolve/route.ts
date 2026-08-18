import { ZodError } from "zod";
import { z } from "zod";
import { jsonOk, jsonError, ApiError } from "@/lib/api";
import { assertAdmin } from "@/lib/admin";
import { resolveDispute } from "@/services/dispute";
import { markDisputeUnderReview } from "@/services/admin";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  decision: z.enum(["APPROVED_REFUND", "REJECTED"]),
  reviewerNote: z.string().max(2000).optional(),
});

/** 事務局審査（x-admin-secret） */
export async function POST(req: Request, ctx: Ctx) {
  try {
    assertAdmin(req);
    const { id } = await ctx.params;
    const body = bodySchema.parse(await req.json());
    await markDisputeUnderReview(id);
    const result = await resolveDispute(id, body.decision, body.reviewerNote);
    return jsonOk(result);
  } catch (e) {
    if (e instanceof ZodError) {
      return jsonError(
        new ApiError(400, e.errors[0]?.message ?? "入力が不正です", "VALIDATION"),
      );
    }
    return jsonError(e);
  }
}
