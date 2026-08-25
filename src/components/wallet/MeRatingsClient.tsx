"use client";

import { useEffect, useState } from "react";
import { PendingRatingsCard } from "@/components/wallet/PendingRatingsCard";
import { ReceivedRatingsCard } from "@/components/wallet/ReceivedRatingsCard";
import { apiFetch } from "@/lib/auth/fetch";

type Received = {
  id: string;
  score: number;
  comment: string | null;
  createdAt: string;
  raterName: string;
  raterPublicId: string | null;
  itemTitle: string;
};

type Pending = {
  transactionId: string;
  itemTitle: string;
  artistName: string | null;
  seller: {
    publicId: string | null;
    displayName: string | null;
  };
};

export function MeRatingsClient() {
  const [pending, setPending] = useState<Pending[] | null>(null);
  const [received, setReceived] = useState<Received[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/me/dashboard");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "取得に失敗しました");
        if (cancelled) return;
        setPending(json.ratings?.pending ?? []);
        setReceived(json.ratings?.received ?? []);
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
  if (!pending || !received) {
    return (
      <section className="card-surface">
        <p className="text-sm text-ink-soft">評価を読み込み中…</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <PendingRatingsCard initialPending={pending} />
      <ReceivedRatingsCard initialRatings={received} />
    </div>
  );
}
