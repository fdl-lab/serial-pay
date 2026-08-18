"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { formatYen } from "@/lib/format";

const SECRET_KEY = "sp_admin_secret";

function normalizeAdminSecret(raw: string) {
  let s = raw.trim();
  // 行ごと貼った場合のプレフィックス除去
  s = s.replace(/^ADMIN_API_SECRET\s*=\s*/i, "");
  // 引用符付きでコピーした場合
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    s = s.slice(1, -1);
  }
  return s.trim();
}

type DisputeRow = {
  id: string;
  status: string;
  reason: string;
  reasonLabel: string;
  description: string | null;
  screenRecordingUrl: string;
  recordingDurationSec: number | null;
  createdAt: string;
  filer: {
    id: string;
    publicId: string | null;
    displayName: string | null;
  };
  transaction: {
    id: string;
    amountChargedYen: number;
    stripePaidYen: number;
    walletPaidYen: number;
    quantity: number;
    status: string;
    item: {
      id: string;
      title: string;
      artistName: string | null;
      eventName: string | null;
    };
  };
};

function adminFetch(path: string, secret: string, init?: RequestInit) {
  return fetch(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "x-admin-secret": secret,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
  });
}

export function AdminConsole() {
  const [secret, setSecret] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [disputes, setDisputes] = useState<DisputeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const saved = window.sessionStorage.getItem(SECRET_KEY);
    if (saved) {
      setSecret(saved);
      setUnlocked(true);
    }
  }, []);

  const load = useCallback(async (adminSecret: string) => {
    setError(null);
    setMessage(null);
    const res = await adminFetch("/api/admin/disputes", adminSecret);
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? "取得に失敗しました");
    }
    setDisputes(json.disputes ?? []);
  }, []);

  useEffect(() => {
    if (!unlocked || !secret) return;
    void load(secret).catch((e) => {
      setError(e instanceof Error ? e.message : "エラー");
      setUnlocked(false);
      window.sessionStorage.removeItem(SECRET_KEY);
    });
  }, [unlocked, secret, load]);

  async function unlock(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cleaned = normalizeAdminSecret(secret);
    if (!cleaned) {
      setError("シークレットが空です");
      return;
    }
    try {
      await load(cleaned);
      window.sessionStorage.setItem(SECRET_KEY, cleaned);
      setSecret(cleaned);
      setUnlocked(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "認証に失敗しました";
      setError(
        msg.includes("管理者のみ") ? "パスワードが違います" : msg,
      );
    }
  }

  function logout() {
    window.sessionStorage.removeItem(SECRET_KEY);
    setUnlocked(false);
    setSecret("");
    setDisputes(null);
  }

  async function resolve(
    id: string,
    decision: "APPROVED_REFUND" | "REJECTED",
  ) {
    const label =
      decision === "APPROVED_REFUND" ? "返金許可" : "却下";
    if (!window.confirm(`この異議を「${label}」しますか？`)) return;

    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      const res = await adminFetch(`/api/admin/disputes/${id}/resolve`, secret, {
        method: "POST",
        body: JSON.stringify({
          decision,
          reviewerNote: notes[id]?.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "処理に失敗しました");
      setMessage(`${label}しました（${id}）`);
      await load(secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラー");
    } finally {
      setBusyId(null);
    }
  }

  if (!unlocked) {
    return (
      <main className="mx-auto max-w-md space-y-4 pb-28">
        <header>
          <p className="brand-mark">シリアルPay</p>
          <h1 className="text-3xl font-extrabold tracking-tight">管理画面</h1>
          <p className="mt-1 text-sm text-ink-soft">
            事務局用です。一般ユーザー向けではありません。
          </p>
        </header>
        <form className="card-surface space-y-3" onSubmit={unlock}>
          <label className="field">
            <span>パスワード</span>
            <input
              type="password"
              autoComplete="current-password"
              spellCheck={false}
              required
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
            />
          </label>
          {error && <p className="banner-error">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block">
            入室する
          </button>
        </form>
        <p className="text-center text-sm">
          <Link href="/" className="font-semibold text-mint-deep underline">
            トップへ戻る
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="space-y-4 pb-28">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="brand-mark">シリアルPay</p>
          <h1 className="text-3xl font-extrabold tracking-tight">管理画面</h1>
          <p className="mt-1 text-sm text-ink-soft">
            未対応の異議申し立てを確認・審査できます
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-ghost !px-3 !py-2 text-xs"
            onClick={() => void load(secret)}
          >
            再読み込み
          </button>
          <button
            type="button"
            className="btn btn-ghost !px-3 !py-2 text-xs"
            onClick={logout}
          >
            退出
          </button>
        </div>
      </header>

      {error && <p className="banner-error">{error}</p>}
      {message && <p className="banner-ok">{message}</p>}

      {disputes === null && (
        <section className="card-surface">
          <p className="text-sm text-ink-soft">読み込み中…</p>
        </section>
      )}

      {disputes && disputes.length === 0 && (
        <section className="card-surface">
          <p className="font-bold">未対応の異議はありません</p>
          <p className="mt-1 text-sm text-ink-soft">
            新しい申し立てがあると、ここに表示されます。
          </p>
        </section>
      )}

      {disputes && disputes.length > 0 && (
        <ul className="space-y-4">
          {disputes.map((d) => (
            <li key={d.id} className="card-surface space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-extrabold text-mint-deep">
                    {d.status === "UNDER_REVIEW" ? "審査中" : "受付済み"}
                    {" · "}
                    {d.reasonLabel}
                  </p>
                  <h2 className="text-lg font-bold">
                    {d.transaction.item.title}
                  </h2>
                  <p className="text-sm text-ink-soft">
                    {d.transaction.item.artistName ?? "アーティスト未設定"}
                    {d.transaction.item.eventName
                      ? ` · ${d.transaction.item.eventName}`
                      : ""}
                  </p>
                </div>
                <p className="font-mono text-sm font-semibold">
                  {formatYen(d.transaction.amountChargedYen)}
                </p>
              </div>

              <dl className="grid gap-1 text-sm text-ink-soft sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-bold">申立人</dt>
                  <dd>
                    {d.filer.displayName ?? "ユーザー"}{" "}
                    <span className="font-mono text-xs">
                      {d.filer.publicId ?? d.filer.id}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold">受付日時</dt>
                  <dd>{new Date(d.createdAt).toLocaleString("ja-JP")}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold">内訳</dt>
                  <dd>
                    Stripe {formatYen(d.transaction.stripePaidYen)} / 残高{" "}
                    {formatYen(d.transaction.walletPaidYen)} ·{" "}
                    {d.transaction.quantity}枚
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold">取引</dt>
                  <dd>
                    <Link
                      href={`/transactions/${d.transaction.id}`}
                      className="font-semibold text-mint-deep underline"
                    >
                      取引ページを開く
                    </Link>
                  </dd>
                </div>
              </dl>

              {d.description && (
                <div className="rounded-xl bg-ink/5 px-3 py-2 text-sm">
                  <p className="text-xs font-bold text-ink-soft">申立内容</p>
                  <p className="mt-1 whitespace-pre-wrap">{d.description}</p>
                </div>
              )}

              <div>
                <a
                  href={d.screenRecordingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost !px-3 !py-2 text-xs"
                >
                  画録を開く
                  {d.recordingDurationSec
                    ? `（約${d.recordingDurationSec}秒）`
                    : ""}
                </a>
              </div>

              <label className="field">
                <span>事務局メモ（任意・ユーザーに通知）</span>
                <textarea
                  rows={2}
                  value={notes[d.id] ?? ""}
                  onChange={(e) =>
                    setNotes((prev) => ({ ...prev, [d.id]: e.target.value }))
                  }
                  placeholder="許可・却下の理由など"
                />
              </label>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  className="btn btn-primary flex-1"
                  disabled={busyId === d.id}
                  onClick={() => void resolve(d.id, "APPROVED_REFUND")}
                >
                  {busyId === d.id ? "処理中…" : "返金を許可"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost flex-1"
                  disabled={busyId === d.id}
                  onClick={() => void resolve(d.id, "REJECTED")}
                >
                  却下する
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
