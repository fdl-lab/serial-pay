import { jsonOk, jsonError, requireUser } from "@/lib/api";
import {
  addFavorite,
  removeFavorite,
  isFavorited,
} from "@/services/favorites";

type Ctx = { params: Promise<{ itemId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { itemId } = await ctx.params;
    const favorited = await isFavorited(user.id, itemId);
    return jsonOk({ favorited });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { itemId } = await ctx.params;
    const result = await addFavorite(user.id, itemId);
    return jsonOk(result);
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { itemId } = await ctx.params;
    const result = await removeFavorite(user.id, itemId);
    return jsonOk(result);
  } catch (e) {
    return jsonError(e);
  }
}
