"use client";

import { useMemo, useState, type FormEvent } from "react";
import { formatYen } from "@/lib/format";
import { apiFetch } from "@/lib/auth/fetch";

type Props = {
  open: boolean;
  balanceYen: number;
  payoutFeeYen: number;
  onClose: () => void;
  onSuccess: () => void;
};

export function PayoutRequestModal({
  open,
  balanceYen,
  payoutFeeYen,
  onClose,
  onSuccess,
}: Props) {
  const maxAmount = Math.max(0, balanceYen - payoutFeeYen);
  const [amount, setAmount] = useState(Math.min(1000, maxAmount));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(() => amount + payoutFeeYen, [amount, payoutFeeYen]);

  if (!open) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/wallet/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountYen: amount }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "出金に失敗しました");
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal>
      <button
        type="button"
        className="absolute inset-0 bg-ink/55 backdrop-blur-sm"
        aria-label="閉じる"
        onClick={onClose}
      />
      <form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-2xl border border-ink/10 bg-paper p-5 shadow-xl"
      >
        <p className="text-sm font-extrabold text-coral">振込申請</p>
        <h2 className="mt-1 text-xl font-bold tracking-tight">銀行口座へ出金</h2>
        <p className="mt-2 text-sm text-ink-soft">
          出金額に加えて振込手数料 {formatYen(payoutFeeYen)} が差し引かれます。
        </p>

        <label className="field mt-4">
          <span>出金額（受け取りたい金額）</span>
          <input
            type="number"
            min={500}
            max={maxAmount}
            required
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </label>

        <dl className="mb-4 space-y-1 rounded-xl bg-ink/5 px-3 py-3 text-sm">
          <div className="flex justify-between">
            <dt>出金額</dt>
            <dd className="font-mono">{formatYen(amount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>手数料</dt>
            <dd className="font-mono">{formatYen(payoutFeeYen)}</dd>
          </div>
          <div className="flex justify-between font-semibold">
            <dt>残高から減る合計</dt>
            <dd className="font-mono">{formatYen(total)}</dd>
          </div>
        </dl>

        {error && <p className="banner-error">{error}</p>}

        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost flex-1" onClick={onClose}>
            キャンセル
          </button>
          <button type="submit" className="btn btn-primary flex-1" disabled={busy || maxAmount < 500}>
            {busy ? "申請中…" : "申請する"}
          </button>
        </div>
      </form>
    </div>
  );
}
