import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeLineCode, fetchLineProfile } from "@/lib/line/oauth";
import { syncLineUser } from "@/services/auth";
import {
  createSessionCookieValue,
  sessionCookieOptions,
  verifyOAuthState,
} from "@/lib/auth/app-session";
import { ApiError } from "@/lib/api";

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
  const cookieNext = cookieStore.get("line_oauth_next")?.value;
  const savedRedirectUri = cookieStore.get("line_oauth_redirect_uri")?.value;

  // 1) 署名付き state（独自ドメインでも Cookie なしで通る）
  // 2) 旧方式の Cookie 一致も許容
  const verified = verifyOAuthState(state);
  const cookieOk = Boolean(savedState && savedState === state);
  if (!verified && !cookieOk) {
    return NextResponse.redirect(`${origin}/auth?error=line_state`);
  }

  const next = cookieNext || verified?.next || "/verify";
  const safeNext = next.startsWith("/") ? next : "/verify";

  try {
    // authorize 時と同じ redirect_uri: Cookie → なければ callback の origin
    const requestOriginForToken = savedRedirectUri
      ? new URL(savedRedirectUri).origin
      : origin;

    const { accessToken } = await exchangeLineCode(code, requestOriginForToken);
    const profile = await fetchLineProfile(accessToken);
    const { user, created } = await syncLineUser(profile);

    const needsProfile = created || !user.profileCompletedAt;
    const dest = needsProfile
      ? `/auth/profile?next=${encodeURIComponent(safeNext)}`
      : safeNext;

    const res = NextResponse.redirect(`${origin}${dest}`);
    const session = sessionCookieOptions(createSessionCookieValue(user.id));
    res.cookies.set(session);
    res.cookies.set("line_oauth_state", "", { path: "/", maxAge: 0 });
    res.cookies.set("line_oauth_next", "", { path: "/", maxAge: 0 });
    res.cookies.set("line_oauth_redirect_uri", "", { path: "/", maxAge: 0 });
    return res;
  } catch (e) {
    console.error("LINE callback failed", e);
    const codeName =
      e instanceof ApiError
        ? e.code === "LINE_BANNED"
          ? "line_banned"
          : e.code === "LINE_COOLDOWN"
            ? "line_cooldown"
            : e.code === "DELETED" || e.code === "SUSPENDED"
              ? "line_blocked"
              : "line_callback"
        : "line_callback";
    return NextResponse.redirect(`${origin}/auth?error=${codeName}`);
  }
}
