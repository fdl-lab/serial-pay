"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/auth/fetch";
import type { VerificationStatus } from "@/types/auth";

const EKYC_LABEL: Record<string, string> = {
  PENDING: "未提出",
  SUBMITTED: "審査中",
  APPROVED: "完了",
  REJECTED: "却下",
};

export function ProfileCard() {
  const [user, setUser] = useState<VerificationStatus | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/me");
      const json = await res.json();
      if (!res.ok) {
        setUser(null);
        return;
      }
      setUser(json.user);
      setDisplayName(json.user.displayName ?? "");
    } catch {
      setError("プロフィールの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveName() {
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await apiFetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          avatarUrl: user?.avatarUrl ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存失敗");
      setUser(json.user);
      setEditing(false);
      setMsg("プロフィールを保存したよ");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  async function onAvatarChange(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await apiFetch("/api/auth/avatar", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "アップロード失敗");
      setUser(json.user);
      setMsg("画像を更新したよ");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="card-surface">
        <p className="text-sm text-ink-soft">プロフィールを読み込み中…</p>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="card-surface">
        <p className="text-sm font-semibold text-ink-soft">アカウント</p>
        <p className="mt-1 font-bold">未ログイン</p>
        <Link href="/auth" className="btn btn-primary btn-block mt-4">
          LINEでログイン
        </Link>
      </section>
    );
  }

  const initial = (user.displayName || "ユ").slice(0, 1);
  const rating =
    user.ratingCount > 0 ? Number(user.ratingScore).toFixed(1) : null;

  return (
    <section className="card-surface space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-soft">プロフィール</p>
          <p className="text-xs text-ink-soft">名前・画像は変更OK / 公開IDは固定</p>
        </div>
        {user.canBuy ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
            利用可能
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
            要確認
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative h-16 w-16 overflow-hidden rounded-full bg-ink text-xl font-extrabold text-white">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center">{initial}</span>
          )}
        </div>
        <label className="btn btn-ghost cursor-pointer !px-3 !py-2 text-xs">
          画像を変更
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={busy}
            onChange={(e) => void onAvatarChange(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {editing ? (
        <div className="space-y-2">
          <label className="field">
            <span>表示名</span>
            <input
              maxLength={40}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary !px-3 !py-2 text-sm"
              disabled={busy}
              onClick={() => void saveName()}
            >
              保存
            </button>
            <button
              type="button"
              className="btn btn-ghost !px-3 !py-2 text-sm"
              onClick={() => {
                setEditing(false);
                setDisplayName(user.displayName ?? "");
              }}
            >
              キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xl font-extrabold">{user.displayName ?? "ユーザー"}</p>
            <p className="text-sm text-ink-soft">
              {rating ? `評価 ★${rating}（${user.ratingCount}件）` : "評価まだなし"}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost !px-3 !py-2 text-xs"
            onClick={() => setEditing(true)}
          >
            名前を変更
          </button>
        </div>
      )}

      <div className="rounded-xl bg-ink/5 px-3 py-3 text-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
          公開ID（変更不可）
        </p>
        <p className="mt-1 font-mono font-semibold">{user.publicId ?? "—"}</p>
        <p className="mt-1 text-xs text-ink-soft">
          なりすまし対策用。名前や画像を変えてもこのIDは変わらないよ。
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-ink/5 px-3 py-2">
          <dt className="text-ink-soft">LINE</dt>
          <dd className="font-semibold">{user.phoneVerified ? "完了" : "未完了"}</dd>
        </div>
        <div className="rounded-xl bg-ink/5 px-3 py-2">
          <dt className="text-ink-soft">eKYC</dt>
          <dd className="font-semibold">{EKYC_LABEL[user.ekycStatus] ?? user.ekycStatus}</dd>
        </div>
      </dl>

      {!user.canBuy && (
        <Link href="/verify" className="btn btn-ghost btn-block">
          本人確認を進める
        </Link>
      )}

      <AccountDeleteSection />

      {error && <p className="banner-error">{error}</p>}
      {msg && <p className="banner-ok">{msg}</p>}
    </section>
  );
}

function AccountDeleteSection() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [canDelete, setCanDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    setError(null);
    const res = await apiFetch("/api/auth/account");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "確認に失敗しました");
      return;
    }
    setCanDelete(Boolean(json.canDelete));
    setBlockers(json.blockers ?? []);
    setOpen(true);
  }

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/auth/account", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "退会に失敗しました");
      router.replace("/auth");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-ink/10 pt-4">
      <button
        type="button"
        className="text-sm font-semibold text-coral underline"
        onClick={() => void loadStatus()}
      >
        退会する
      </button>
      {open && (
        <div className="mt-3 space-y-2 rounded-xl border border-coral/30 bg-coral/5 p-3 text-sm">
          <p className="font-bold text-coral">退会の確認</p>
          <p className="text-ink-soft">
            未完了の取引（支払待ち・開示前・確認中・異議中）がある場合は退会できないよ。
            退会後は同じアカウントは復活せず、同じLINEでは30日間再登録できないよ。期限後は新規アカウント（公開IDも新規・eKYCやり直し）になるよ。
          </p>
          {blockers.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-ink-soft">
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-soft">いま退会できる状態だよ。本当に退会する？</p>
          )}
          {error && <p className="banner-error">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-ghost !px-3 !py-2 text-xs"
              onClick={() => setOpen(false)}
            >
              やめる
            </button>
            <button
              type="button"
              className="btn btn-primary !px-3 !py-2 text-xs"
              disabled={!canDelete || busy}
              onClick={() => void confirmDelete()}
            >
              {busy ? "退会処理中…" : "退会する"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
