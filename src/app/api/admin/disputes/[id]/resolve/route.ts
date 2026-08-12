import { ZodError } from "zod";
import { z } from "zod";
import { jsonOk, jsonError, requireUser, ApiError } from "@/lib/api";
import { resolveDispute } from "@/services/dispute";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  decision: z.enum(["APPROVED_REFUND", "REJECTED"]),
  reviewerNote: z.string().max(2000).optional(),
});

function assertAdmin(req: Request) {
  const secret = process.env.ADMIN_API_SECRET;
  const header = req.headers.get("x-admin-secret");
  if (secret && header === secret) return;
  if (process.env.DEV_AUTH_BYPASS === "true") return;
  throw new ApiError(403, "管理者のみ操作できるよ", "FORBIDDEN");
}

/** 事務局審査（ADMIN_API_SECRET または DEV_AUTH_BYPASS） */
export async function POST(req: Request, ctx: Ctx) {
  try {
    assertAdmin(req);
    await requireUser(req);
    const { id } = await ctx.params;
    const body = bodySchema.parse(await req.json());
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
