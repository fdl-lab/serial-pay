export type LineProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  email?: string | null;
};

function isLocalHostUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * コールバックURLを解決する。
 * 本番ホストからのリクエストは、独自ドメインでもその origin を優先する
 *（LINE Developers に同じコールバックを登録しておくこと）。
 */
export function resolveLineCallbackUrl(requestOrigin?: string | null): string {
  const configured = process.env.LINE_CALLBACK_URL?.trim();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const origin = (requestOrigin || "").replace(/\/$/, "");

  // 実ホスト（www / apex / vercel）→ いま開いているドメインで callback
  if (origin && !isLocalHostUrl(origin)) {
    return `${origin}/api/auth/line/callback`;
  }

  if (configured) {
    return configured;
  }

  if (appUrl) return `${appUrl}/api/auth/line/callback`;
  return "http://127.0.0.1:3000/api/auth/line/callback";
}

function requireLineConfig(requestOrigin?: string | null) {
  const channelId = process.env.LINE_CHANNEL_ID;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelId || !channelSecret) {
    throw new Error("LINE_CHANNEL_ID / LINE_CHANNEL_SECRET が未設定です");
  }
  const callbackUrl = resolveLineCallbackUrl(requestOrigin);
  return { channelId, channelSecret, callbackUrl };
}

export function isLineConfigured(): boolean {
  return Boolean(process.env.LINE_CHANNEL_ID && process.env.LINE_CHANNEL_SECRET);
}

export function buildLineAuthorizeUrl(
  state: string,
  requestOrigin?: string | null,
): string {
  const { channelId, callbackUrl } = requireLineConfig(requestOrigin);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: channelId,
    redirect_uri: callbackUrl,
    state,
    scope: "profile openid",
  });
  return `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
}

export async function exchangeLineCode(
  code: string,
  requestOrigin?: string | null,
): Promise<{
  accessToken: string;
  idToken?: string;
}> {
  const { channelId, channelSecret, callbackUrl } = requireLineConfig(requestOrigin);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: callbackUrl,
    client_id: channelId,
    client_secret: channelSecret,
  });

  const res = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    id_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(
      `LINE token exchange failed: ${json.error_description || json.error || res.status} (redirect_uri=${callbackUrl})`,
    );
  }
  return { accessToken: json.access_token, idToken: json.id_token };
}

export async function fetchLineProfile(accessToken: string): Promise<LineProfile> {
  const res = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as {
    userId?: string;
    displayName?: string;
    pictureUrl?: string;
    message?: string;
  };
  if (!res.ok || !json.userId) {
    throw new Error(json.message || "LINE profile fetch failed");
  }
  return {
    userId: json.userId,
    displayName: json.displayName || "LINEユーザー",
    pictureUrl: json.pictureUrl,
  };
}
