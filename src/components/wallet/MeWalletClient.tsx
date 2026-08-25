"use client";

import { useEffect, useState } from "react";
import { WalletHistoryCard } from "@/components/wallet/WalletHistoryCard";
import { apiFetch } from "@/lib/auth/fetch";

export function MeWalletClient() {
  const [recent, setRecent] = useState<
    | {
        id: string;
        type: string;
        amountYen: number;
        createdAt: string;
        description: string | null;
      }[]
    | null
  >(null);
  const [payouts, setPayouts] = useState<
    | {
        id: string;
        amountYen: number;
        feeYen: number;
        status: string;
        createdAt: string;
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
        setRecent(json.wallet?.recent ?? []);
        setPayouts(json.wallet?.payouts ?? []);
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
  if (!recent || !payouts) {
    return (
      <section className="card-surface">
        <p className="text-sm text-ink-soft">残高履歴を読み込み中…</p>
      </section>
    );
  }

  return <WalletHistoryCard recent={recent} payouts={payouts} />;
}
