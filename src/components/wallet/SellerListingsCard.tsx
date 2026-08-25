"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatYen } from "@/lib/format";
import { apiFetch } from "@/lib/auth/fetch";
import { ME_PREVIEW_LIMIT, MoreLink } from "@/components/wallet/MeListHelpers";

type ListingRow = {
  id: string;
  title: string;
  artistName: string | null;
  eventName: string | null;
  listingType: "SET" | "INVENTORY";
  unitPriceYen: number;
  stockAvailable: number;
  stockTotal: number;
  setQuantity: number | null;
  status: string;
  updatedAt: string;
};

const statusLabel: Record<string, string> = {
  DRAFT: "下書き",
  ACTIVE: "出品中",
  SOLD_OUT: "売り切れ",
};

export function SellerListingsCard({
  initialItems,
  previewLimit,
  moreHref = "/me/listings",
}: {
  initialItems?: ListingRow[] | null;
  previewLimit?: number;
  moreHref?: string;
}) {
  const [items, setItems] = useState<ListingRow[] | null>(initialItems ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/listings/mine");
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setItems([]);
          return;
        }
        throw new Error(json.error ?? "取得に失敗しました");
      }
      setItems(json.items ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  }, []);

  useEffect(() => {
    if (initialItems) return;
    void load();
  }, [initialItems, load]);

  async function archive(id: string, title: string) {
    if (
      !window.confirm(
        `「${title}」を削除（非公開）しますか？進行中の取引がある場合は削除できません。`,
      )
    ) {
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const res = await apiFetch(`/api/listings/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "削除に失敗しました");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusyId(null);
    }
  }

  if (items === null && !error) {
    return (
      <section className="card-surface">
        <p className="text-sm text-ink-soft">出品一覧を読み込み中…</p>
      </section>
    );
  }

  return (
    <section className="card-surface space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="me-section-title">出品中のシリアル</h2>
          <p className="me-section-desc">
            内容の編集や、出品の削除（非公開）ができます
          </p>
        </div>
        <Link href="/sell" className="btn btn-primary shrink-0 !px-3 !py-2 text-xs">
          新規出品
        </Link>
      </div>

      {error && <p className="banner-error">{error}</p>}

      {items && items.length === 0 && (
        <p className="text-sm text-ink-soft">
          まだ出品がありません。{" "}
          <Link href="/sell" className="font-semibold text-mint-deep underline">
            出品する
          </Link>
        </p>
      )}

      {items && items.length > 0 && (
        <ul className="divide-y divide-ink/10">
          {(typeof previewLimit === "number"
            ? items.slice(0, previewLimit)
            : items
          ).map((item) => (
            <li key={item.id} className="space-y-2 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {item.artistName && (
                    <p className="truncate text-xs font-extrabold text-mint-deep">
                      {item.artistName}
                    </p>
                  )}
                  <p className="me-item-title truncate">{item.title}</p>
                  <p className="me-item-meta">
                    {statusLabel[item.status] ?? item.status}
                    {" · "}
                    {formatYen(item.unitPriceYen)} / 枚
                    {" · "}
                    在庫 {item.stockAvailable}/{item.stockTotal}
                    {item.listingType === "SET" && item.setQuantity
                      ? ` · セット${item.setQuantity}枚`
                      : " · バラ売り"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/sell/${item.id}/edit`}
                  className="btn btn-ghost !px-3 !py-2 text-xs"
                >
                  編集
                </Link>
                <Link
                  href={`/items/${item.id}`}
                  className="btn btn-ghost !px-3 !py-2 text-xs"
                >
                  公開ページ
                </Link>
                <button
                  type="button"
                  className="btn btn-ghost !px-3 !py-2 text-xs text-coral"
                  disabled={busyId === item.id}
                  onClick={() => void archive(item.id, item.title)}
                >
                  {busyId === item.id ? "削除中…" : "削除"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {items && typeof previewLimit === "number" && (
        <MoreLink
          href={moreHref}
          total={items.length}
          limit={previewLimit || ME_PREVIEW_LIMIT}
        />
      )}
    </section>
  );
}
