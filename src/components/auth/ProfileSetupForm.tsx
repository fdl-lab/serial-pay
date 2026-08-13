"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/auth/fetch";
import { compressAvatarFile } from "@/lib/image/compress-avatar";
import type { VerificationStatus } from "@/types/auth";

export function ProfileSetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/verify";

  const [user, setUser] = useState<VerificationStatus | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await apiFetch("/api/auth/me");
    const json = await res.json();
    if (!res.ok) {
      router.replace("/auth");
      return;
    }
    setUser(json.user);
    setDisplayName(json.user.displayName ?? "");
    setAvatarUrl(json.user.avatarUrl);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onAvatarChange(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const compressed = await compressAvatarFile(file);
      const form = new FormData();
      form.append("file", compressed);
      const res = await apiFetch("/api/auth/avatar", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "アップロード失敗");
      setAvatarUrl(json.url);
      setUser(json.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, avatarUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存に失敗");
      const dest = next.startsWith("/") ? next : "/verify";
      router.push(dest);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  const initial = (displayName || "ユ").slice(0, 1);

  return (
    <form className="card-surface space-y-4" onSubmit={save}>
      <header>
        <p className="brand-mark">シリアルPay</p>
        <h1 className="text-3xl font-extrabold tracking-tight">プロフィール設定</h1>
        <p className="mt-2 text-ink-soft">
          表示名と画像はあとからマイページでも変えられるよ。公開IDは変更できないから安心だね。
        </p>
      </header>

      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 overflow-hidden rounded-full bg-ink text-2xl font-extrabold text-white">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center">{initial}</span>
          )}
        </div>
        <label className="btn btn-ghost cursor-pointer !px-3 !py-2 text-sm">
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

      <label className="field">
        <span>表示名</span>
        <input
          required
          maxLength={40}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="ニックネーム"
        />
      </label>

      <div className="rounded-xl bg-ink/5 px-3 py-3 text-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
          公開ID（変更不可）
        </p>
        <p className="mt-1 font-mono font-semibold">
          {user?.publicId ?? "発行中…"}
        </p>
        <p className="mt-1 text-xs text-ink-soft">
          名前や画像を変えてもこのIDは変わらないよ。なりすまし対策の目印だよ。
        </p>
      </div>

      {error && <p className="banner-error">{error}</p>}

      <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
        {busy ? "保存中…" : "保存して次へ"}
      </button>
    </form>
  );
}
