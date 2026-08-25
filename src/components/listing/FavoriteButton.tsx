"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/auth/fetch";

type Props = {
  itemId: string;
  initialFavorited?: boolean | null;
  className?: string;
  compact?: boolean;
};

export function FavoriteButton({
  itemId,
  initialFavorited = null,
  className = "",
  compact = false,
}: Props) {
  const router = useRouter();
  const [favorited, setFavorited] = useState<boolean | null>(initialFavorited);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (initialFavorited !== null) return;
    try {
      const res = await apiFetch(`/api/favorites/${itemId}`);
      if (res.status === 401) {
        setFavorited(false);
        return;
      }
      const json = await res.json();
      if (res.ok) setFavorited(Boolean(json.favorited));
    } catch {
      setFavorited(false);
    }
  }, [itemId, initialFavorited]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      const method = favorited ? "DELETE" : "POST";
      const res = await apiFetch(`/api/favorites/${itemId}`, { method });
      const json = await res.json();
      if (res.status === 401) {
        router.push("/auth");
        return;
      }
      if (!res.ok) throw new Error(json.error ?? "更新に失敗しました");
      setFavorited(Boolean(json.favorited));
    } catch {
      // keep previous
    } finally {
      setBusy(false);
    }
  }

  const on = favorited === true;

  return (
    <button
      type="button"
      className={`btn btn-ghost !px-3 !py-2 text-sm ${className}`}
      disabled={busy || favorited === null}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void toggle();
      }}
      aria-pressed={on}
      aria-label={on ? "お気に入り解除" : "お気に入りに追加"}
    >
      {compact
        ? on
          ? "★"
          : "☆"
        : on
          ? "★ お気に入り済"
          : "☆ お気に入り"}
    </button>
  );
}
