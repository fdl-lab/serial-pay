"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/auth/fetch";
import type { VerificationStatus } from "@/types/auth";

const EKYC_LABEL: Record<string, string> = {
  PENDING: "未提出",
  SUBMITTED: "審査中",
  APPROVED: "完了",
  REJECTED: "却下",
};

export function VerifyClient() {
  const searchParams = useSearchParams();
  const ekycReturn = searchParams.get("ekyc") === "return";

  const [user, setUser] = useState<VerificationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ekycMessage, setEkycMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch("/api/auth/me");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "取得に失敗しました");
      setUser(json.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (ekycReturn) {
      setEkycMessage("本人確認を受け付けたよ。結果が反映されるまで少し待ってね。");
      void load();
    }
  }, [ekycReturn, load]);

  async function startEkyc() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/ekyc/start", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "本人確認の開始に失敗しました");
      if (json.url) {
        window.location.href = json.url;
        return;
      }
      throw new Error("本人確認URLを取得できませんでした");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  const allDone = user?.canBuy;

  return (
    <div className="space-y-4">
      <header>
        <p className="brand-mark">シリアルPay</p>
        <h1 className="text-3xl font-extrabold tracking-tight">本人確認</h1>
        <p className="mt-1 text-ink-soft">購入・出品には SMS + eKYC が必要だよ</p>
      </header>

      {error && (
        <div className="banner-error">
          <p>{error}</p>
          {error.includes("ログイン") && (
            <Link href="/auth" className="mt-2 inline-block font-semibold underline">
              SMSログインへ
            </Link>
          )}
        </div>
      )}

      {ekycMessage && <p className="banner-ok">{ekycMessage}</p>}

      {user && (
        <>
          <section className="card-surface space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-ink-soft">SMS認証</p>
                <p className="font-bold">
                  {user.phoneVerified ? "完了" : "未完了"}
                </p>
                {user.phoneE164 && (
                  <p className="text-xs text-ink-soft font-mono">{user.phoneE164}</p>
                )}
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  user.phoneVerified
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-amber-100 text-amber-900"
                }`}
              >
                {user.phoneVerified ? "OK" : "要対応"}
              </span>
            </div>

            {!user.phoneVerified && (
              <Link href="/auth" className="btn btn-primary btn-block">
                SMSログインする
              </Link>
            )}

            <div className="border-t border-ink/10 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-soft">eKYC（本人確認）</p>
                  <p className="font-bold">{EKYC_LABEL[user.ekycStatus] ?? user.ekycStatus}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    user.ekycStatus === "APPROVED"
                      ? "bg-emerald-100 text-emerald-800"
                      : user.ekycStatus === "REJECTED"
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-900"
                  }`}
                >
                  {user.ekycStatus === "APPROVED" ? "OK" : "要対応"}
                </span>
              </div>

              {user.phoneVerified && user.ekycStatus !== "APPROVED" && (
                <button
                  type="button"
                  className="btn btn-primary btn-block mt-4 min-h-12"
                  disabled={busy || user.ekycStatus === "SUBMITTED"}
                  onClick={startEkyc}
                >
                  {busy
                    ? "準備中…"
                    : user.ekycStatus === "SUBMITTED"
                      ? "審査中（しばらくお待ちを）"
                      : user.ekycStatus === "REJECTED"
                        ? "本人確認をやり直す"
                        : "本人確認を始める（Stripe Identity）"}
                </button>
              )}
            </div>
          </section>

          {allDone && (
            <section className="card-surface">
              <p className="font-bold text-mint-deep">すべて完了！</p>
              <p className="mt-1 text-sm text-ink-soft">
                購入・出品ができるようになったよ。
              </p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <Link href="/" className="btn btn-primary">
                  出品を見る
                </Link>
                <Link href="/sell" className="btn btn-ghost">
                  出品する
                </Link>
              </div>
            </section>
          )}
        </>
      )}

      {!user && !error && <p className="text-ink-soft">読み込み中…</p>}
    </div>
  );
}
