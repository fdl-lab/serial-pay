import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncSupabaseUser } from "@/services/auth";

export type AuthSessionUser = {
  id: string;
  email: string;
};

/** サーバー側で現在のログインユーザー ID を取得（Supabase → DEV バイパス） */
export async function getSessionUser(): Promise<AuthSessionUser | null> {
  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const {
      data: { user: sbUser },
    } = await supabase.auth.getUser();
    if (sbUser) {
      const user = await syncSupabaseUser(sbUser);
      return { id: user.id, email: user.email };
    }
  }

  if (process.env.DEV_AUTH_BYPASS === "true" && process.env.DEV_USER_ID) {
    return { id: process.env.DEV_USER_ID, email: "dev@local" };
  }
  return null;
}
