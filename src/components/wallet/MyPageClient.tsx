"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { WalletBalanceCard } from "./WalletBalanceCard";
import { PayoutRequestModal } from "./PayoutRequestModal";
import { VerificationStatusCard } from "@/components/auth/VerificationStatusCard";
import { formatYen } from "@/lib/format";
import { apiFetch } from "@/lib/auth/fetch";

type WalletResponse = {
  balanceYen: number;
  pendingYen: number;
  payoutFeeYen: number;
  connectStatus: string;
  recent: {
    id: string;
    type: string;
    amountYen: number;
    createdAt: string;
    description: string | null;
  }[];
  payouts: {
    id: string;
    amountYen: number;
    feeYen: number;
    status: string;
    createdAt: string;
  }[];
};

function MyPageInner() {
  const searchParams = useSearchParams();
  const connectReturn =
    searchParams.get("connect") === "return" ||
    searchParams.get("connect") === "refresh";

  const [data, setData] = useState<WalletResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await apiFetch("/api/wallet");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "取得に失敗しました");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!connectReturn) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/connect/onboard");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Connect同期に失敗");
        if (cancelled) return;
        setConnectMsg(
          json.status === "ACTIVE"
            ? "銀行口座の登録が完了したよ"
            : "口座登録はまだ完了していないみたい。もう一度「銀行口座を登録」から進めてね",
        );
        await load();
      } catch (e) {
        if (!cancelled) {
          setConnectMsg(e instanceof Error ? e.message : "Connect同期エラー");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connectReturn, load]);

  return (
    <div className="space-y-4">
      <header>
        <p className="brand-mark">シリアルPay</p>
        <h1 className="text-3xl font-extrabold tracking-tight">マイページ</h1>
        <p className="mt-1 text-ink-soft">売上残高の確認と振込申請</p>
      </header>

      {error && <p className="banner-error">{error}</p>}
      {connectMsg && <p className="banner-ok">{connectMsg}</p>}

      <VerificationStatusCard />

      {data && (
        <>
          <WalletBalanceCard
            balanceYen={data.balanceYen}
            pendingYen={data.pendingYen}
            payoutFeeYen={data.payoutFeeYen}
            connectStatus={data.connectStatus}
            onRequestPayout={() => setPayoutOpen(true)}
          />

          <section className="card-surface">
            <h2 className="text-lg font-bold">最近の残高履歴</h2>
            <ul className="mt-3 divide-y divide-ink/10">
              {data.recent.length === 0 && (
                <li className="py-3 text-sm text-ink-soft">まだ履歴はないよ</li>
              )}
              {data.recent.map((row) => (
                <li key={row.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-semibold">{row.description ?? row.type}</p>
                    <p className="text-xs text-ink-soft">
                      {new Date(row.createdAt).toLocaleString("ja-JP")}
                    </p>
                  </div>
                  <p
                    className={`font-mono font-semibold ${
                      row.amountYen >= 0 ? "text-mint-deep" : "text-coral"
                    }`}
                  >
                    {row.amountYen >= 0 ? "+" : ""}
                    {formatYen(row.amountYen)}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="card-surface">
            <h2 className="text-lg font-bold">出金申請</h2>
            <ul className="mt-3 divide-y divide-ink/10">
              {data.payouts.length === 0 && (
                <li className="py-3 text-sm text-ink-soft">申請履歴なし</li>
              )}
              {data.payouts.map((p) => (
                <li key={p.id} className="flex justify-between py-3 text-sm">
                  <div>
                    <p className="font-semibold">{formatYen(p.amountYen)}</p>
                    <p className="text-xs text-ink-soft">
                      手数料 {formatYen(p.feeYen)} · {p.status}
                    </p>
                  </div>
                  <p className="text-xs text-ink-soft">
                    {new Date(p.createdAt).toLocaleDateString("ja-JP")}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <PayoutRequestModal
            open={payoutOpen}
            balanceYen={data.balanceYen}
            payoutFeeYen={data.payoutFeeYen}
            onClose={() => setPayoutOpen(false)}
            onSuccess={() => void load()}
          />
        </>
      )}

      {!data && !error && <p className="text-ink-soft">読み込み中…</p>}
    </div>
  );
}

export function MyPageClient() {
  return (
    <Suspense fallback={<p className="text-ink-soft">読み込み中…</p>}>
      <MyPageInner />
    </Suspense>
  );
}
