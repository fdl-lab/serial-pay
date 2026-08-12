import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeLineCode, fetchLineProfile } from "@/lib/line/oauth";
import { syncLineUser } from "@/services/auth";
import {
  createSessionCookieValue,
  sessionCookieOptions,
} from "@/lib/auth/app-session";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const origin = url.origin;

  if (err || !code || !state) {
    return NextResponse.redirect(`${origin}/auth?error=line_denied`);
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get("line_oauth_state")?.value;
  const next = cookieStore.get("line_oauth_next")?.value || "/verify";
  const safeNext = next.startsWith("/") ? next : "/verify";

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${origin}/auth?error=line_state`);
  }

  try {
    const { accessToken } = await exchangeLineCode(code);
    const profile = await fetchLineProfile(accessToken);
    const user = await syncLineUser(profile);

    const res = NextResponse.redirect(`${origin}${safeNext}`);
    const session = sessionCookieOptions(createSessionCookieValue(user.id));
    res.cookies.set(session);
    res.cookies.set("line_oauth_state", "", { path: "/", maxAge: 0 });
    res.cookies.set("line_oauth_next", "", { path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    console.error("LINE callback failed", e);
    return NextResponse.redirect(`${origin}/auth?error=line_callback`);
  }
}
