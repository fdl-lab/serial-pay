import { NextResponse } from "next/server";
import { buildLineAuthorizeUrl, isLineConfigured } from "@/lib/line/oauth";
import { newOAuthState } from "@/lib/auth/app-session";

export async function GET(req: Request) {
  if (!isLineConfigured()) {
    return NextResponse.redirect(
      new URL("/auth?error=line_config", req.url),
    );
  }

  const url = new URL(req.url);
  const next = url.searchParams.get("next") || "/verify";
  const safeNext = next.startsWith("/") ? next : "/verify";
  const state = newOAuthState();

  const res = NextResponse.redirect(buildLineAuthorizeUrl(state));
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
  return res;
}
