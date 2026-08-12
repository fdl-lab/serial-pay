export type LineProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  email?: string | null;
};

function requireLineConfig() {
  const channelId = process.env.LINE_CHANNEL_ID;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelId || !channelSecret) {
    throw new Error("LINE_CHANNEL_ID / LINE_CHANNEL_SECRET が未設定です");
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000";
  const callbackUrl =
    process.env.LINE_CALLBACK_URL ?? `${appUrl.replace(/\/$/, "")}/api/auth/line/callback`;
  return { channelId, channelSecret, callbackUrl };
}

export function isLineConfigured(): boolean {
  return Boolean(process.env.LINE_CHANNEL_ID && process.env.LINE_CHANNEL_SECRET);
}

export function buildLineAuthorizeUrl(state: string): string {
  const { channelId, callbackUrl } = requireLineConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: channelId,
    redirect_uri: callbackUrl,
    state,
    scope: "profile openid email",
  });
  return `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;
}

export async function exchangeLineCode(code: string): Promise<{
  accessToken: string;
  idToken?: string;
}> {
  const { channelId, channelSecret, callbackUrl } = requireLineConfig();
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
    throw new Error(json.error_description || json.error || "LINE token exchange failed");
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
