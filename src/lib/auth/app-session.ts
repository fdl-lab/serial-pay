import { createHmac, timingSafeEqual, randomBytes } from "crypto";

const COOKIE_NAME = "sp_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

type SessionPayload = {
  uid: string;
  exp: number;
};

function sessionSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET ||
    process.env.SERIAL_ENCRYPTION_KEY ||
    "dev-only-change-me"
  );
}

function sign(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function encode(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string): SessionPayload | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.uid || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function createSessionCookieValue(userId: string): string {
  return encode({
    uid: userId,
    exp: Date.now() + MAX_AGE_SEC * 1000,
  });
}

export function readSessionUserId(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match?.[1]) return null;
  const payload = decode(decodeURIComponent(match[1]));
  return payload?.uid ?? null;
}

export function sessionCookieOptions(value: string) {
  return {
    name: COOKIE_NAME,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SEC,
  };
}

export function clearSessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

type OAuthStatePayload = {
  n: string; // nonce
  exp: number;
  next?: string;
};

/** Cookie なしでも検証できる署名付き OAuth state（独自ドメイン跨ぎ対策） */
export function createOAuthState(next?: string): string {
  const payload: OAuthStatePayload = {
    n: randomBytes(16).toString("hex"),
    exp: Date.now() + 10 * 60 * 1000,
    next: next && next.startsWith("/") ? next : undefined,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyOAuthState(state: string): { next: string } | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as OAuthStatePayload;
    if (!payload.n || !payload.exp || payload.exp < Date.now()) return null;
    const next =
      payload.next && payload.next.startsWith("/") ? payload.next : "/verify";
    return { next };
  } catch {
    return null;
  }
}

/** @deprecated use createOAuthState */
export function newOAuthState(): string {
  return createOAuthState();
}
