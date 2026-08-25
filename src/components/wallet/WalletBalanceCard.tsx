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
      <p className="me-section-title">売上金ウォレット</p>
      <p className="me-section-desc">取引完了後の売上（手数料13%差引後）</p>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight sm:text-3xl">
        {formatYen(balanceYen)}
      </p>
      {pendingYen > 0 && (
        <p className="me-item-meta mt-1">
          出金処理中: {formatYen(pendingYen)}
        </p>
      )}
      {connectStatus === "ACTIVE" ? (
        <p className="me-item-meta mt-2 inline-flex items-center rounded-md bg-mint/15 px-2 py-0.5 font-extrabold text-mint-deep">
          銀行口座 登録完了
        </p>
      ) : (
        <p className="me-section-desc mt-2">
          出金には銀行口座の登録が必要です
        </p>
      )}
      {connectError && <p className="banner-error mt-3">{connectError}</p>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="btn btn-primary !px-4 !py-2 text-xs"
          onClick={onRequestPayout}
        >
          振込申請（手数料 {formatYen(payoutFeeYen)}）
        </button>
        {connectStatus !== "ACTIVE" && (
          <button
            type="button"
            className="btn btn-ghost !px-4 !py-2 text-xs"
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
