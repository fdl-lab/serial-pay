import { ZodError } from "zod";
import { jsonCreated, jsonOk, jsonError, requireUser, ApiError } from "@/lib/api";
import { createListing, listPublicItems } from "@/services/listing";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? undefined;
    const items = await listPublicItems({ q });
    return jsonOk({ items, q: q?.trim() || null });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = await req.json();
    const result = await createListing(user, body);
    return jsonCreated(result);
  } catch (e) {
    if (e instanceof ZodError) {
      return jsonError(new ApiError(400, e.errors[0]?.message ?? "入力が不正です", "VALIDATION"));
    }
    return jsonError(e);
  }
}
