"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatYen } from "@/lib/format";
import { apiFetch } from "@/lib/auth/fetch";
import { isTrialListing } from "@/lib/trial-listing";

type Props = {
  itemId: string;
  title: string;
  listingType: "SET" | "INVENTORY";
  unitPriceYen: number;
  stockAvailable: number;
  setQuantity: number | null;
  status: string;
  confirmationWindowMinutes: number;
  /** 応募期限の30分前〜期限後は購入不可 */
  purchaseBlocked?: boolean;
  saleEndedLabel?: string;
};

export function BuyPanel({
  itemId,
  title,
  listingType,
  unitPriceYen,
  stockAvailable,
  setQuantity,
  status,
  purchaseBlocked = false,
  saleEndedLabel = "販売終了",
}: Props) {
  const router = useRouter();
  const trial = isTrialListing({ title, unitPriceYen });
  const maxQty =
    listingType === "SET" ? (setQuantity ?? stockAvailable) : stockAvailable;
  const [qty, setQty] = useState(listingType === "SET" ? maxQty : 1);
  const [useWallet, setUseWallet] = useState(!trial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buyQty = trial ? 1 : qty;
  const subtotal = useMemo(
    () => unitPriceYen * buyQty,
    [unitPriceYen, buyQty],
  );
  const soldOut =
    purchaseBlocked || status !== "ACTIVE" || stockAvailable <= 0;
  const endedByExpiry =
    purchaseBlocked && status === "ACTIVE" && stockAvailable > 0;

  async function buy() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId,
          quantity: trial || listingType === "SET" ? undefined : qty,
          useWalletYen: trial ? 0 : useWallet ? subtotal : 0,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "PHONE_REQUIRED") {
          setError(`${json.error} → LINEでログインしてください`);
          return;
        }
        if (json.code === "EKYC_REQUIRED") {
          setError(`${json.error} → 本人確認ページへ進んでください`);
          return;
        }
        throw new Error(json.error ?? "購入に失敗しました");
      }

      if (json.paidWithWallet && json.transactionId) {
        router.push(`/transactions/${json.transactionId}`);
        return;
      }

      if (json.clientSecret && json.transactionId) {
        router.push(`/checkout/${json.transactionId}`);
        return;
      }

      throw new Error("予期しないレスポンスです");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-ink/10 pt-4">
      {endedByExpiry && (
        <p className="rounded-xl bg-ink/[0.06] px-3 py-2.5 text-sm font-semibold text-ink-soft">
          応募期限が近い、または過ぎているため購入できません。
        </p>
      )}

      {listingType === "INVENTORY" && !soldOut && !trial && (
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
        <span className="font-mono text-lg font-semibold">
          {trial ? "¥0（無料）" : formatYen(subtotal)}
        </span>
      </div>

      {!trial && !soldOut && (
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={useWallet}
            onChange={(e) => setUseWallet(e.target.checked)}
          />
          売上金残高で支払う（足りれば即開示 / 足りなければカード併用）
        </label>
      )}

      {error && (
        <div className="space-y-2">
          <p className="banner-error !mb-0">{error}</p>
          {(error.includes("ログイン") || error.includes("未ログイン")) && (
            <Link href="/auth" className="btn btn-primary btn-block text-sm">
              LINEでログイン
            </Link>
          )}
          {(error.includes("eKYC") || error.includes("本人確認")) &&
            !error.includes("ログイン") && (
              <Link href="/verify" className="btn btn-ghost btn-block text-sm">
                本人確認へ進む
              </Link>
            )}
        </div>
      )}

      {trial && !soldOut && (
        <p className="text-xs leading-relaxed text-ink-soft">
          お試しは LINEログインのみでOK（本人確認は不要）です。
        </p>
      )}

      <button
        type="button"
        className="btn btn-primary btn-block min-h-12 text-base"
        disabled={busy || soldOut}
        onClick={buy}
      >
        {soldOut
          ? purchaseBlocked || status === "SOLD_OUT"
            ? saleEndedLabel
            : "売り切れ"
          : busy
            ? "処理中…"
            : trial
              ? "無料で試す"
              : "購入する"}
      </button>
    </div>
  );
}
