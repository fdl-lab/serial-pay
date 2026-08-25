import { jsonOk, jsonError, requireUser } from "@/lib/api";
import {
  createListingComment,
  listListingComments,
} from "@/services/listing-comments";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const comments = await listListingComments(id);
    return jsonOk({
      comments: comments.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
        replies: c.replies.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        })),
      })),
    });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  try {
    const user = await requireUser(req);
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as {
      body?: string;
      parentId?: string | null;
    };
    const comment = await createListingComment(
      user,
      id,
      body.body ?? "",
      body.parentId,
    );
    return jsonOk({
      comment: {
        ...comment,
        createdAt: comment.createdAt.toISOString(),
      },
    });
  } catch (e) {
    return jsonError(e);
  }
}
