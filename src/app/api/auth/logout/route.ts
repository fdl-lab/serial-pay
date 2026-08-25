import { NextResponse } from "next/server";
import { clearSessionCookieOptions } from "@/lib/auth/app-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
  } catch {
    // セッション切れでもログアウト自体は成功扱いにする
  }

  const res = NextResponse.json({ ok: true });
  const clear = clearSessionCookieOptions();
  res.cookies.set(clear);
  res.cookies.set("line_oauth_state", "", { path: "/", maxAge: 0 });
  res.cookies.set("line_oauth_next", "", { path: "/", maxAge: 0 });
  res.cookies.set("line_oauth_redirect_uri", "", { path: "/", maxAge: 0 });
  return res;
}
