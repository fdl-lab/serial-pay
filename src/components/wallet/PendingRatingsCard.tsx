"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/auth/fetch";
import { RatingForm } from "@/components/rating/RatingForm";

type Pending = {
  transactionId: string;
  itemTitle: string;
  artistName: string | null;
  seller: {
    publicId: string | null;
    displayName: string | null;
  };
};

export function PendingRatingsCard() {
  const [pending, setPending] = useState<Pending[] | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/ratings");
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setPending([]);
          return;
        }
        throw new Error(json.error ?? "取得失敗");
      }
      setPending(json.pending ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return <p className="banner-error">{error}</p>;
  if (!pending) {
    return (
      <section className="card-surface">
        <p className="text-sm text-ink-soft">評価待ちを読み込み中…</p>
      </section>
    );
  }
  if (pending.length === 0) return null;

  return (
    <section className="card-surface space-y-3">
      <div>
        <h2 className="text-lg font-bold">評価して完了してね</h2>
        <p className="mt-1 text-sm text-ink-soft">
          受取確認済みで、まだ評価していない取引があるよ。評価すると取引完了になるよ
        </p>
      </div>
      <ul className="divide-y divide-ink/10">
        {pending.map((p) => (
          <li key={p.transactionId} className="space-y-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {p.artistName ? `${p.artistName} · ` : ""}
                  {p.itemTitle}
                </p>
                <p className="text-xs text-ink-soft">
                  出品者 {p.seller.displayName ?? "出品者"}
                  {p.seller.publicId ? ` · ${p.seller.publicId}` : ""}
                </p>
              </div>
              {activeId !== p.transactionId && (
                <button
                  type="button"
                  className="btn btn-primary shrink-0 !px-3 !py-2 text-xs"
                  onClick={() => setActiveId(p.transactionId)}
                >
                  評価する
                </button>
              )}
            </div>
            {activeId === p.transactionId && (
              <RatingForm
                transactionId={p.transactionId}
                onDone={() => {
                  setActiveId(null);
                  void load();
                }}
              />
            )}
            <Link
              href={`/transactions/${p.transactionId}`}
              className="text-xs font-semibold text-mint-deep underline"
            >
              取引を開く
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
