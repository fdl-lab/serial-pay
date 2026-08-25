"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatYen } from "@/lib/format";
import { apiFetch } from "@/lib/auth/fetch";
import { ME_PREVIEW_LIMIT, MoreLink } from "@/components/wallet/MeListHelpers";

type FavItem = {
  itemId: string;
  createdAt: string;
  item: {
    id: string;
    title: string;
    artistName: string | null;
    eventName: string | null;
    unitPriceYen: number;
    status: string;
    stockAvailable: number;
    listingType: string;
    setQuantity: number | null;
  };
};

export function FavoritesCard({
  initialFavorites,
  previewLimit,
  moreHref = "/me/favorites",
}: {
  initialFavorites?: FavItem[] | null;
  previewLimit?: number;
  moreHref?: string;
}) {
  const [favorites, setFavorites] = useState<FavItem[] | null>(
    initialFavorites ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/favorites");
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setFavorites([]);
          return;
        }
        throw new Error(json.error ?? "取得に失敗しました");
      }
      setFavorites(json.favorites ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  }, []);

  useEffect(() => {
    if (initialFavorites) return;
    void load();
  }, [initialFavorites, load]);

  async function remove(itemId: string) {
    setBusyId(itemId);
    try {
      const res = await apiFetch(`/api/favorites/${itemId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? "解除に失敗しました");
      }
      setFavorites((prev) =>
        prev ? prev.filter((f) => f.itemId !== itemId) : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusyId(null);
    }
  }

  if (error) return <p className="banner-error">{error}</p>;

  if (!favorites) {
    return (
      <section className="card-surface">
        <p className="text-sm text-ink-soft">お気に入りを読み込み中…</p>
      </section>
    );
  }

  return (
    <section className="card-surface space-y-3">
      <div>
        <h2 className="me-section-title">お気に入り</h2>
        <p className="me-section-desc">保存した出品一覧</p>
      </div>

      {favorites.length === 0 && (
        <p className="text-sm text-ink-soft">まだお気に入りはありません</p>
      )}

      <ul className="divide-y divide-ink/10">
        {(typeof previewLimit === "number"
          ? favorites.slice(0, previewLimit)
          : favorites
        ).map((f) => (
          <li
            key={f.itemId}
            className="flex items-start justify-between gap-3 py-3"
          >
            <div className="min-w-0">
              <Link
                href={`/items/${f.item.id}`}
                className="me-item-title text-mint-deep underline"
              >
                {f.item.title}
              </Link>
              <p className="me-item-body mt-1">
                {f.item.artistName ?? "アーティスト未設定"}
                {f.item.eventName ? ` · ${f.item.eventName}` : ""}
              </p>
              <p className="me-item-meta mt-1 font-mono font-semibold text-ink">
                {formatYen(f.item.unitPriceYen)}
                {f.item.status === "SOLD_OUT" ? " · 売り切れ" : ""}
              </p>
            </div>
            <button
              type="button"
              className="btn btn-ghost shrink-0 !px-2 !py-1 text-xs"
              disabled={busyId === f.itemId}
              onClick={() => void remove(f.itemId)}
            >
              解除
            </button>
          </li>
        ))}
      </ul>
      {typeof previewLimit === "number" && (
        <MoreLink
          href={moreHref}
          total={favorites.length}
          limit={previewLimit || ME_PREVIEW_LIMIT}
        />
      )}
    </section>
  );
}
