"use client";

/** API 呼び出し（Supabase クッキー + 開発用ヘッダ） */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const devId = process.env.NEXT_PUBLIC_DEV_USER_ID;
  if (devId && !headers.has("x-user-id")) {
    headers.set("x-user-id", devId);
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}
