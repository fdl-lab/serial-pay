import { ZodError } from "zod";
import { jsonOk, jsonError, requireUser, ApiError } from "@/lib/api";
import { getMeStatus, updateProfile } from "@/services/auth";

export async function PATCH(req: Request) {
  try {
    const user = await requireUser(req);
    const body = await req.json();
    const updated = await updateProfile(user.id, body);
    return jsonOk({ user: await getMeStatus(updated) });
  } catch (e) {
    if (e instanceof ZodError) {
      return jsonError(
        new ApiError(400, e.errors[0]?.message ?? "入力が不正です", "VALIDATION"),
      );
    }
    return jsonError(e);
  }
}
