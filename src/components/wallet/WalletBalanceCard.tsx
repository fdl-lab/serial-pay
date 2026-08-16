"use client";

import { formatYen } from "@/lib/format";
import { useState } from "react";
import { apiFetch } from "@/lib/auth/fetch";

type Props = {
  balanceYen: number;
  pendingYen: number;
  payoutFeeYen: number;
  connectStatus: string;
  onRequestPayout: () => void;
};

export function WalletBalanceCard({
  balanceYen,
  pendingYen,
  payoutFeeYen,
  connectStatus,
  onRequestPayout,
}: Props) {
  const [connectBusy, setConnectBusy] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  async function startConnect() {
    setConnectBusy(true);
    setConnectError(null);
    try {
      const res = await apiFetch("/api/connect/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Connect 開始に失敗");
      if (json.url) window.location.href = json.url;
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "エラー");
    } finally {
      setConnectBusy(false);
    }
  }

  return (
    <section className="card-surface overflow-hidden bg-gradient-to-br from-white via-white to-mint/10">
      <p className="brand-mark">売上金ウォレット</p>
      <p className="text-sm text-ink-soft">取引完了後の売上（手数料15%差引後）</p>
      <p className="mt-3 font-mono text-4xl font-semibold tracking-tight">
        {formatYen(balanceYen)}
      </p>
      {pendingYen > 0 && (
        <p className="mt-1 text-sm text-ink-soft">
          出金処理中: {formatYen(pendingYen)}
        </p>
      )}
      {connectError && <p className="banner-error mt-3">{connectError}</p>}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button type="button" className="btn btn-primary" onClick={onRequestPayout}>
          振込申請（手数料 {formatYen(payoutFeeYen)}）
        </button>
        {connectStatus !== "ACTIVE" && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={connectBusy}
            onClick={startConnect}
          >
            {connectBusy ? "接続中…" : "銀行口座を登録"}
          </button>
        )}
      </div>
    </section>
  );
}
