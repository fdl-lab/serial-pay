import { ZodError } from "zod";
import { jsonCreated, jsonError, requireUser, ApiError } from "@/lib/api";
import { createDispute } from "@/services/dispute";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const body = await req.json();
    const result = await createDispute(user.id, id, body);
    return jsonCreated(result);
  } catch (e) {
    if (e instanceof ZodError) {
      return jsonError(
        new ApiError(400, e.errors[0]?.message ?? "入力が不正です", "VALIDATION"),
      );
    }
    return jsonError(e);
  }
}
