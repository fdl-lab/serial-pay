"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatYen } from "@/lib/format";
import { apiFetch } from "@/lib/auth/fetch";

type Purchase = {
  id: string;
  status: string;
  awaitingReveal: boolean;
  awaitingRating?: boolean;
  quantity: number;
  amountChargedYen: number;
  codeRevealedAt: string | null;
  revealDeadlineAt: string | null;
  confirmationDeadlineAt: string | null;
  createdAt: string;
  itemTitle: string;
  artistName: string | null;
  eventName: string | null;
};

function formatDeadline(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PendingPurchasesCard() {
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/purchases");
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setPurchases([]);
          return;
        }
        throw new Error(json.error ?? "取得に失敗しました");
      }
      setPurchases(json.purchases ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return <p className="banner-error">{error}</p>;
  }

  if (!purchases) {
    return (
      <section className="card-surface">
        <p className="text-sm text-ink-soft">購入履歴を読み込み中…</p>
      </section>
    );
  }

  const pendingReveal = purchases.filter((p) => p.awaitingReveal);
  const inWindow = purchases.filter((p) => !p.awaitingReveal);

  return (
    <section className="card-surface space-y-4">
      <div>
        <h2 className="text-lg font-bold">開示前・確認中のシリアル</h2>
        <p className="mt-1 text-sm text-ink-soft">
          購入後のキャンセルはできないよ。開示は72時間まで保留できるけど、過ぎると返金なしで取引完了・評価★1になるよ
        </p>
      </div>

      {purchases.length === 0 && (
        <p className="text-sm text-ink-soft">いま開示待ちの購入はないよ</p>
      )}

      {pendingReveal.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-coral">
            開示前（保留中）
          </p>
          <ul className="divide-y divide-ink/10">
            {pendingReveal.map((p) => {
              const until = formatDeadline(p.revealDeadlineAt);
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {p.artistName ? `${p.artistName} · ` : ""}
                      {p.itemTitle}
                    </p>
                    <p className="text-xs text-ink-soft">
                      {p.quantity}枚 · {formatYen(p.amountChargedYen)} · 未開示
                      {until ? ` · 開示期限 ${until}` : ""}
                    </p>
                  </div>
                  <Link
                    href={`/transactions/${p.id}`}
                    className="btn btn-primary shrink-0 !px-3 !py-2 text-xs"
                  >
                    開示する
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {inWindow.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-mint-deep">
            開示済み・確認中
          </p>
          <ul className="divide-y divide-ink/10">
            {inWindow.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {p.artistName ? `${p.artistName} · ` : ""}
                    {p.itemTitle}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {p.quantity}枚 · {formatYen(p.amountChargedYen)}
                    {p.status === "DISPUTED"
                      ? " · 異議中（タイマー停止）"
                      : p.awaitingRating
                        ? " · 評価待ち（評価で完了）"
                        : " · 確認期限内"}
                  </p>
                </div>
                <Link
                  href={`/transactions/${p.id}`}
                  className="btn btn-ghost shrink-0 !px-3 !py-2 text-xs"
                >
                  開く
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
