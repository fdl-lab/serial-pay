import { ZodError } from "zod";
import { jsonCreated, jsonError, jsonOk, requireUser, ApiError } from "@/lib/api";
import { createDispute, getDisputePageState } from "@/services/dispute";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const result = await getDisputePageState(user.id, id);
    return jsonOk(result);
  } catch (e) {
    return jsonError(e);
  }
}

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
