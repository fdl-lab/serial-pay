import { ZodError } from "zod";
import {
  jsonOk,
  jsonError,
  requireUser,
  ApiError,
} from "@/lib/api";
import {
  archiveListing,
  getSellerListingForEdit,
  updateListing,
} from "@/services/listing";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const item = await getSellerListingForEdit(user.id, id);
    return jsonOk({ item });
  } catch (e) {
    return jsonError(e);
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const body = await req.json();
    const result = await updateListing(user, id, body);
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

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const result = await archiveListing(user, id);
    return jsonOk(result);
  } catch (e) {
    return jsonError(e);
  }
}
