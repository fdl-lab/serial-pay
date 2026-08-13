import { NextResponse } from "next/server";
import { buildLineAuthorizeUrl, isLineConfigured, resolveLineCallbackUrl } from "@/lib/line/oauth";
import { newOAuthState } from "@/lib/auth/app-session";

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
  const state = newOAuthState();
  const callbackUrl = resolveLineCallbackUrl(origin);

  const res = NextResponse.redirect(buildLineAuthorizeUrl(state, origin));
  res.cookies.set("line_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  res.cookies.set("line_oauth_next", safeNext, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  // token 交換時に authorize と同じ redirect_uri を使う
  res.cookies.set("line_oauth_redirect_uri", callbackUrl, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return res;
}
