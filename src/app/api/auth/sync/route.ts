import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ApiError, jsonOk, jsonError } from "@/lib/api";
import { syncSupabaseUser, toVerificationStatus } from "@/services/auth";

/** Supabase ログイン後に Prisma User を同期 */
export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      throw new ApiError(503, "Supabase が未設定です", "SUPABASE_NOT_CONFIGURED");
    }
    const {
      data: { user: sbUser },
    } = await supabase.auth.getUser();
    if (!sbUser) {
      throw new ApiError(401, "未ログイン", "UNAUTHORIZED");
    }
    const user = await syncSupabaseUser(sbUser);
    return jsonOk({ user: toVerificationStatus(user) });
  } catch (e) {
    return jsonError(e);
  }
}
