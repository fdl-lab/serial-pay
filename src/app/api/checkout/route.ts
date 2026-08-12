import { ZodError } from "zod";
import { jsonOk, jsonError, requireUser, ApiError } from "@/lib/api";
import { createCheckout } from "@/services/checkout";

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = await req.json();
    const result = await createCheckout(user, body);
    return jsonOk(result);
  } catch (e) {
    if (e instanceof ZodError) {
      return jsonError(new ApiError(400, e.errors[0]?.message ?? "入力が不正です", "VALIDATION"));
    }
    return jsonError(e);
  }
}
