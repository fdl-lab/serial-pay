"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatYen } from "@/lib/format";
import { apiFetch } from "@/lib/auth/fetch";

type Props = {
  itemId: string;
  listingType: "SET" | "INVENTORY";
  unitPriceYen: number;
  stockAvailable: number;
  setQuantity: number | null;
  status: string;
  confirmationWindowMinutes: number;
};

export function BuyPanel({
  itemId,
  listingType,
  unitPriceYen,
  stockAvailable,
  setQuantity,
  status,
}: Props) {
  const router = useRouter();
  const maxQty = listingType === "SET" ? (setQuantity ?? stockAvailable) : stockAvailable;
  const [qty, setQty] = useState(listingType === "SET" ? maxQty : 1);
  const [useWallet, setUseWallet] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(() => unitPriceYen * qty, [unitPriceYen, qty]);
  const soldOut = status !== "ACTIVE" || stockAvailable <= 0;

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          quantity: listingType === "SET" ? undefined : qty,
          useWalletYen: useWallet ? subtotal : 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "PHONE_REQUIRED" || json.code === "EKYC_REQUIRED") {
          setError(`${json.error} → 本人確認ページへ進んでね`);
          return;
        }
        throw new Error(json.error ?? "購入に失敗しました");
      }

      if (json.paidWithWallet && json.transactionId) {
        router.push(`/transactions/${json.transactionId}`);
        return;
      }

      if (json.clientSecret) {
        setError(
          "カード決済用の clientSecret は取得できたよ。Stripe Elements 連携はこれから。いまは残高フル払いを試してね。",
        );
        return;
      }

      throw new Error("予期しないレスポンスだよ");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-ink/10 pt-4">
      {listingType === "INVENTORY" && !soldOut && (
        <label className="field !mb-0">
          <span>購入枚数</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={maxQty}
            value={qty}
            className="min-h-12"
            onChange={(e) =>
              setQty(Math.min(maxQty, Math.max(1, Number(e.target.value) || 1)))
            }
          />
        </label>
      )}

      <div className="flex items-center justify-between text-sm">
        <span className="font-semibold text-ink-soft">合計</span>
        <span className="font-mono text-lg font-semibold">{formatYen(subtotal)}</span>
      </div>

      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={useWallet}
          onChange={(e) => setUseWallet(e.target.checked)}
        />
        売上金残高で支払う（足りれば即開示）
      </label>

      {error && (
        <div className="space-y-2">
          <p className="banner-error !mb-0">{error}</p>
          {(error.includes("LINE") ||
            error.includes("SMS") ||
            error.includes("eKYC") ||
            error.includes("本人確認")) && (
            <Link href="/verify" className="btn btn-ghost btn-block text-sm">
              本人確認へ進む
            </Link>
          )}
        </div>
      )}

      {/* スマホは下部ナビの上に固定しやすい余白付きフル幅ボタン */}
      <button
        type="button"
        className="btn btn-primary btn-block min-h-12 text-base"
        disabled={busy || soldOut}
        onClick={buy}
      >
        {soldOut ? "売り切れ" : busy ? "処理中…" : "購入する"}
      </button>
    </div>
  );
}
