import { ZodError, z } from "zod";
import { jsonOk, jsonError, requireUser, ApiError } from "@/lib/api";
import { requestPayout } from "@/services/wallet";

const bodySchema = z.object({
  amountYen: z.number().int().min(500),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = bodySchema.parse(await req.json());
    const result = await requestPayout(user, body.amountYen);
    return jsonOk(result);
  } catch (e) {
    if (e instanceof ZodError) {
      return jsonError(new ApiError(400, e.errors[0]?.message ?? "入力が不正です"));
    }
    return jsonError(e);
  }
}
