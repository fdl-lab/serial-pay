"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/auth/fetch";
import { compressAvatarFile } from "@/lib/image/compress-avatar";
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
      const compressed = await compressAvatarFile(file);
      const form = new FormData();
      form.append("file", compressed);
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
          {busy ? "更新中…" : "画像を変更"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/*"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              e.target.value = "";
              void onAvatarChange(f);
            }}
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
  const [loading, setLoading] = useState(false);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [openTxs, setOpenTxs] = useState<
    {
      id: string;
      statusLabel: string;
      role: string;
      itemTitle: string;
      cancellable: boolean;
    }[]
  >([]);
  const [canDelete, setCanDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/auth/account");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "確認に失敗しました");
        setOpen(true);
        return;
      }
      setCanDelete(Boolean(json.canDelete));
      setBlockers(json.blockers ?? []);
      setOpenTxs(json.openTransactions ?? []);
      setOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }

  async function cancelPending(transactionId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/auth/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel_pending", transactionId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "キャンセルに失敗");
      setCanDelete(Boolean(json.canDelete));
      setBlockers(json.blockers ?? []);
      setOpenTxs(json.openTransactions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!canDelete) return;
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
        className="text-xs text-ink-soft underline decoration-ink/20 underline-offset-2 transition hover:text-ink disabled:opacity-50"
        disabled={loading}
        onClick={() => void loadStatus()}
      >
        {loading ? "確認中…" : "退会する"}
      </button>
      {open && (
        <div className="mt-3 space-y-3 rounded-xl border border-coral/30 bg-coral/5 p-3 text-sm">
          <p className="font-bold text-coral">退会の確認</p>
          <p className="text-ink-soft">
            未完了の取引がある場合は退会できないよ。退会後は同じアカウントは復活せず、同じLINEでは30日間再登録できないよ。
          </p>

          {openTxs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-ink-soft">未完了の取引</p>
              <ul className="space-y-2">
                {openTxs.map((tx) => (
                  <li
                    key={tx.id}
                    className="rounded-lg border border-ink/10 bg-white px-3 py-2"
                  >
                    <p className="font-semibold">{tx.itemTitle}</p>
                    <p className="text-xs text-ink-soft">
                      {tx.statusLabel}
                      {tx.role === "seller" ? "（出品）" : "（購入）"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link
                        href={`/transactions/${tx.id}`}
                        className="text-xs font-semibold text-mint-deep underline"
                      >
                        取引を開く
                      </Link>
                      {tx.cancellable && (
                        <button
                          type="button"
                          className="text-xs font-semibold text-coral underline"
                          disabled={busy}
                          onClick={() => void cancelPending(tx.id)}
                        >
                          支払い待ちをキャンセル
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {blockers.length > 0 && openTxs.length === 0 && (
            <ul className="list-disc space-y-1 pl-5 text-ink-soft">
              {blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          )}

          {canDelete ? (
            <p className="font-semibold text-ink">
              いま退会できる状態だよ。本当に退会する？
            </p>
          ) : (
            <p className="font-semibold text-coral">
              上の未完了取引を片付けると「退会を確定する」が押せるよ
            </p>
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
              className="btn btn-primary !px-3 !py-2 text-xs disabled:opacity-40"
              disabled={!canDelete || busy}
              onClick={() => void confirmDelete()}
            >
              {busy ? "処理中…" : canDelete ? "退会を確定する" : "まだ退会できない"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
