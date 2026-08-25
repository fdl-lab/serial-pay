import { jsonOk, jsonError, requireUser } from "@/lib/api";
import { listMyListingCommentInbox } from "@/services/listing-comments";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const inbox = await listMyListingCommentInbox(user.id);
    return jsonOk({
      onMyListings: inbox.onMyListings.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
      authored: inbox.authored.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return jsonError(e);
  }
}
