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
  REJECTED: "再提出が必要",
};

function loginLabel(user: VerificationStatus): string {
  if (user.authProvider === "line") return "LINEログイン";
  if (user.phoneE164) return "SMS認証";
  return "ログイン";
}

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

  const refreshEkyc = useCallback(async () => {
    try {
      const res = await apiFetch("/api/ekyc/refresh", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "状況の確認に失敗しました");
      await load();
      if (json.ekycStatus === "APPROVED") {
        setEkycMessage("本人確認が完了しました。");
      } else if (json.ekycStatus === "REJECTED") {
        setEkycMessage(
          "追加の確認が必要です。「本人確認をやり直す」からもう一度お試しください。",
        );
      }
      return json.ekycStatus as string;
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
      return null;
    }
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!ekycReturn) return;
    setEkycMessage(
      "本人確認を受け付けました。結果を確認しています…",
    );
    let cancelled = false;
    let tries = 0;

    (async () => {
      while (!cancelled && tries < 12) {
        tries += 1;
        const status = await refreshEkyc();
        if (status === "APPROVED" || status === "REJECTED") return;
        await new Promise((r) => setTimeout(r, 2500));
      }
      if (!cancelled) {
        setEkycMessage(
          "まだ審査中です。少し待ってから「状況を確認する」を押すか、時間をおいてこのページを開き直してください。",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ekycReturn, refreshEkyc]);

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

  async function checkStatus() {
    setBusy(true);
    setError(null);
    setEkycMessage("状況を確認しています…");
    try {
      const status = await refreshEkyc();
      if (status === "SUBMITTED" || status === "PENDING") {
        setEkycMessage(
          "まだ審査中です。通常は数分で完了します。しばらくしてからもう一度確認してください。",
        );
      }
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
        <p className="mt-1 text-ink-soft">
          購入・出品には LINEログインと本人確認が必要です
        </p>
      </header>

      {error && (
        <div className="banner-error">
          <p>{error}</p>
          {(error.includes("ログイン") || error.includes("未ログイン")) && (
            <Link href="/auth" className="mt-2 inline-block font-semibold underline">
              LINEログインへ
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
                <p className="text-sm font-semibold text-ink-soft">{loginLabel(user)}</p>
                <p className="font-bold">
                  {user.phoneVerified ? "完了" : "未完了"}
                </p>
                {user.displayName && (
                  <p className="text-xs text-ink-soft">{user.displayName}</p>
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
                LINEでログインする
              </Link>
            )}

            <div className="border-t border-ink/10 pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink-soft">
                    本人確認（書類）
                  </p>
                  <p className="font-bold">
                    {EKYC_LABEL[user.ekycStatus] ?? user.ekycStatus}
                  </p>
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
                <div className="mt-4 space-y-2">
                  {user.ekycStatus === "SUBMITTED" && (
                    <button
                      type="button"
                      className="btn btn-primary btn-block min-h-12"
                      disabled={busy}
                      onClick={() => void checkStatus()}
                    >
                      {busy ? "確認中…" : "状況を確認する"}
                    </button>
                  )}
                  <button
                    type="button"
                    className={`btn btn-block min-h-12 ${
                      user.ekycStatus === "SUBMITTED"
                        ? "btn-ghost"
                        : "btn-primary"
                    }`}
                    disabled={busy}
                    onClick={startEkyc}
                  >
                    {busy
                      ? "準備中…"
                      : user.ekycStatus === "REJECTED"
                        ? "本人確認をやり直す"
                        : user.ekycStatus === "SUBMITTED"
                          ? "最初からやり直す"
                          : "本人確認を始める"}
                  </button>
                </div>
              )}
            </div>
          </section>

          {allDone && (
            <section className="card-surface">
              <p className="font-bold text-mint-deep">すべて完了しました</p>
              <p className="mt-1 text-sm text-ink-soft">
                購入・出品ができるようになりました。
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
