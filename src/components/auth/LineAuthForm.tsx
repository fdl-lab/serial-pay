"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

const ERROR_MSG: Record<string, string> = {
  line_config: "LINE_CHANNEL_ID / SECRET が未設定だよ。.env.local を確認してね",
  line_denied: "LINEログインがキャンセルされたみたい",
  line_state: "セキュリティ検証に失敗したよ。もう一度試してね",
  line_callback: "LINEログイン処理に失敗したよ。コールバックURLを確認してね",
  line_banned: "このLINEアカウントは利用停止中だよ",
  line_cooldown:
    "退会後30日間は同じLINEで再登録できないよ。期限後は新しいアカウントになるよ（昔のアカウントは復活しないよ）",
  line_blocked: "このアカウントではログインできないよ",
  line: "LINEログインに失敗したよ。もう一度試してみてね",
};

export function LineAuthForm({ redirectTo = "/verify" }: { redirectTo?: string }) {
  const searchParams = useSearchParams();
  const errKey = searchParams.get("error") || "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    errKey ? ERROR_MSG[errKey] || ERROR_MSG.line : null,
  );

  function loginWithLine() {
    setBusy(true);
    setError(null);
    const next = encodeURIComponent(redirectTo);
    window.location.href = `/api/auth/line/start?next=${next}`;
  }

  return (
    <div className="card-surface">
      <header className="mb-6">
        <p className="brand-mark">シリアルPay</p>
        <h1 className="text-3xl font-extrabold tracking-tight">LINEでログイン</h1>
        <p className="mt-2 text-ink-soft">
          LINEアカウントでかんたんログイン。購入・出品には本人確認（eKYC）も必要だよ。
        </p>
      </header>

      <button
        type="button"
        className="btn btn-block min-h-12 text-base font-bold text-white"
        style={{ backgroundColor: "#06C755" }}
        disabled={busy}
        onClick={loginWithLine}
      >
        {busy ? "LINEへ移動中…" : "LINEでログイン"}
      </button>

      <p className="mt-4 text-center text-xs text-ink-soft">
        ログイン後、本人確認ページに進むよ
      </p>

      {error && <p className="banner-error mt-4">{error}</p>}
    </div>
  );
}
