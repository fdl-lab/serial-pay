"use client";

import { useEffect, useState } from "react";
import { PendingPurchasesCard } from "@/components/wallet/PendingPurchasesCard";
import { PurchaseHistoryCard } from "@/components/wallet/PurchaseHistoryCard";
import { apiFetch } from "@/lib/auth/fetch";

export function MePurchasesClient() {
  const [purchases, setPurchases] = useState<unknown[] | null>(null);
  const [history, setHistory] = useState<
    | {
        id: string;
        status: string;
        quantity: number;
        amountChargedYen: number;
        codeRevealedAt: string | null;
        createdAt: string;
        completedAt: string;
        itemTitle: string;
        artistName: string | null;
        eventName: string | null;
        seller: {
          publicId: string | null;
          displayName: string | null;
          avatarUrl: string | null;
        };
      }[]
    | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/me/dashboard");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "取得に失敗しました");
        if (cancelled) return;
        setPurchases(json.purchases?.purchases ?? []);
        setHistory(json.purchases?.history ?? []);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "エラー");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <p className="banner-error">{error}</p>;
  if (!purchases || !history) {
    return (
      <section className="card-surface">
        <p className="text-sm text-ink-soft">購入履歴を読み込み中…</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <PendingPurchasesCard initialPurchases={purchases as never} />
      <PurchaseHistoryCard initialHistory={history} />
    </div>
  );
}
