"use client";

/** API 呼び出し（Supabase クッキー。開発バイパス時のみ x-user-id） */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const bypass = process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === "true";
  const devId = process.env.NEXT_PUBLIC_DEV_USER_ID;
  if (bypass && devId && !headers.has("x-user-id")) {
    headers.set("x-user-id", devId);
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}
