import { ZodError } from "zod";
import { jsonOk, jsonError, requireUser, ApiError } from "@/lib/api";
import { getCheckoutSessionForBuyer } from "@/services/checkout";

type Props = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Props) {
  try {
    const user = await requireUser(req);
    const { id } = await params;
    const session = await getCheckoutSessionForBuyer(user.id, id);
    return jsonOk(session);
  } catch (e) {
    if (e instanceof ZodError) {
      return jsonError(new ApiError(400, e.errors[0]?.message ?? "入力が不正です", "VALIDATION"));
    }
    return jsonError(e);
  }
}
