import { jsonOk, jsonError, requireUser } from "@/lib/api";
import { listFavorites } from "@/services/favorites";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const favorites = await listFavorites(user.id);
    return jsonOk({
      favorites: favorites.map((f) => ({
        ...f,
        createdAt: f.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return jsonError(e);
  }
}
