import { NextResponse } from "next/server";
import {
  buildLineAuthorizeUrl,
  isLineConfigured,
  resolveLineCallbackUrl,
} from "@/lib/line/oauth";
import { createOAuthState } from "@/lib/auth/app-session";

function cookieSecure(origin: string) {
  return (
    process.env.NODE_ENV === "production" || origin.startsWith("https://")
  );
}

export async function GET(req: Request) {
  if (!isLineConfigured()) {
    return NextResponse.redirect(
      new URL("/auth?error=line_config", req.url),
    );
  }

  const url = new URL(req.url);
  const origin = url.origin;
  const next = url.searchParams.get("next") || "/verify";
  const safeNext = next.startsWith("/") ? next : "/verify";
  const state = createOAuthState(safeNext);
  const callbackUrl = resolveLineCallbackUrl(origin);
  const secure = cookieSecure(origin);

  const res = NextResponse.redirect(buildLineAuthorizeUrl(state, origin));
  // 補助用（署名付き state が本体）。同ドメインなら next 復元にも使う
  res.cookies.set("line_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 600,
  });
  res.cookies.set("line_oauth_next", safeNext, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 600,
  });
  res.cookies.set("line_oauth_redirect_uri", callbackUrl, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 600,
  });
  return res;
}
