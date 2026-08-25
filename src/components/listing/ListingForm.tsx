"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { formatYen } from "@/lib/format";
import { calcPriceBreakdown } from "@/lib/money";
import { apiFetch } from "@/lib/auth/fetch";
import {
  fromDatetimeLocalValue,
  minDatetimeLocalValue,
} from "@/lib/serial-expiry";

type ListingType = "SET" | "INVENTORY";

type Props = {
  onCreated?: (itemId: string) => void;
};

function isLoginRequiredError(message: string) {
  return (
    message.includes("ログイン") ||
    message.includes("未ログイン") ||
    message.includes("UNAUTHORIZED")
  );
}

const EXPIRY_NOTE =
  "※シリアルコードの応募締め切り日時（有効期限）を正確に選択してください。複数の期間がある場合は最後の期間の最終日時を入力してください。";

export function ListingForm({ onCreated }: Props) {
  const [listingType, setListingType] = useState<ListingType>("INVENTORY");
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [eventName, setEventName] = useState("");
  const [unitPriceYen, setUnitPriceYen] = useState("1200");
  const [setQuantity, setSetQuantity] = useState(5);
  const [codesText, setCodesText] = useState("");
  const [serialExpiresLocal, setSerialExpiresLocal] = useState("");
  const [minExpiry, setMinExpiry] = useState("");
  const [bulkOn, setBulkOn] = useState(false);
  const [bulkMin, setBulkMin] = useState(10);
  const [bulkPct, setBulkPct] = useState(10);
  const [marketAvg, setMarketAvg] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const codes = useMemo(
    () =>
      codesText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    [codesText],
  );

  const payoutPreview = useMemo(() => {
    const price = Number(unitPriceYen);
    if (!Number.isFinite(price) || price <= 0) return null;
    const qty = listingType === "SET" ? Math.max(1, setQuantity || 1) : 1;
    return calcPriceBreakdown({
      unitPriceYen: Math.floor(price),
      quantity: qty,
      feePercent: 13,
    });
  }, [listingType, setQuantity, unitPriceYen]);

  useEffect(() => {
    setMinExpiry(minDatetimeLocalValue());
  }, []);

  useEffect(() => {
    if (!eventName.trim()) {
      setMarketAvg(null);
      return;
    }
    const t = window.setTimeout(async () => {
      const res = await fetch(
        `/api/market-stats?eventName=${encodeURIComponent(eventName.trim())}`,
      );
      const json = await res.json();
      setMarketAvg(json.market?.avgPriceYen ?? null);
    }, 400);
    return () => window.clearTimeout(t);
  }, [eventName]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      if (!serialExpiresLocal) {
        throw new Error("応募期限を選択してください");
      }
      if (unitPriceYen.trim() === "") {
        throw new Error("1枚あたり単価を入力してください");
      }
      const priceYen = Number(unitPriceYen);
      if (!Number.isInteger(priceYen) || priceYen < 100) {
        throw new Error("単価は100円以上の整数で入力してください");
      }
      const serialExpiresAt = fromDatetimeLocalValue(
        serialExpiresLocal,
      ).toISOString();

      const body = {
        title,
        artistName: artistName.trim(),
        eventName: eventName || undefined,
        listingType,
        unitPriceYen: priceYen,
        setQuantity: listingType === "SET" ? setQuantity : undefined,
        serialCodes: codes,
        serialExpiresAt,
        bulkDiscountEnabled: listingType === "INVENTORY" && bulkOn,
        bulkDiscountMinQty: bulkOn ? bulkMin : null,
        bulkDiscountPercent: bulkOn ? bulkPct : null,
        publish: true,
      };

      const res = await apiFetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "出品に失敗しました");
      setMessage(`出品が完了しました。ID: ${json.item.id}`);
      onCreated?.(json.item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card-surface" onSubmit={submit}>
      <header className="mb-5">
        <p className="brand-mark">シリアルPay</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          出品する
        </h1>
        <p className="me-section-desc">
          登録したシリアルは暗号化して保管され、他の人に見られることはありません。
        </p>
      </header>

      <fieldset className="mb-4">
        <legend className="mb-2 text-sm font-semibold">出品形式</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label
            className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
              listingType === "INVENTORY"
                ? "border-mint bg-mint/10"
                : "border-ink/15 bg-white"
            }`}
          >
            <input
              type="radio"
              name="listingType"
              className="mr-2"
              checked={listingType === "INVENTORY"}
              onChange={() => setListingType("INVENTORY")}
            />
            在庫管理型（バラ売り）
          </label>
          <label
            className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
              listingType === "SET"
                ? "border-mint bg-mint/10"
                : "border-ink/15 bg-white"
            }`}
          >
            <input
              type="radio"
              name="listingType"
              className="mr-2"
              checked={listingType === "SET"}
              onChange={() => setListingType("SET")}
            />
            セット販売（まとめ売り）
          </label>
        </div>
      </fieldset>

      <label className="field">
        <span>タイトル</span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例: ○○ツアー シリアル バラ売り"
        />
      </label>

      <label className="field">
        <span>アーティスト名</span>
        <input
          required
          value={artistName}
          onChange={(e) => setArtistName(e.target.value)}
          placeholder="例: Sample Artists / ○○"
          autoComplete="off"
        />
      </label>

      <label className="field">
        <span>イベント名・公演名（任意）</span>
        <input
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
          placeholder="例: ○○ Live 2026"
        />
      </label>

      {marketAvg != null && (
        <p className="mb-4 rounded-xl border border-dashed border-mint-deep/40 bg-mint/10 px-3 py-2 text-sm">
          直近の平均相場めやす: <strong>{formatYen(marketAvg)}</strong> / 枚
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="field">
          <span>1枚あたり単価（円）</span>
          <input
            type="number"
            min={100}
            inputMode="numeric"
            required
            value={unitPriceYen}
            onChange={(e) => setUnitPriceYen(e.target.value)}
          />
        </label>
        {listingType === "SET" && (
          <label className="field">
            <span>セット枚数</span>
            <input
              type="number"
              min={1}
              required
              value={setQuantity}
              onChange={(e) => setSetQuantity(Number(e.target.value))}
            />
          </label>
        )}
      </div>

      {payoutPreview && payoutPreview.amountChargedYen > 0 && (
        <div className="mb-4 rounded-xl border border-mint/30 bg-mint/10 px-3 py-3 text-sm leading-relaxed">
          <p className="font-bold text-mint-deep">売上の目安（販売手数料差引後）</p>
          <p className="mt-1 text-ink-soft">
            {listingType === "SET"
              ? `販売額 ${formatYen(payoutPreview.amountChargedYen)}（単価×${payoutPreview.quantity}）`
              : `販売額 ${formatYen(payoutPreview.amountChargedYen)}（1枚）`}
            {" − "}
            手数料{payoutPreview.platformFeePercent}%（
            {formatYen(payoutPreview.platformFeeYen)}）
          </p>
          <p className="mt-1 text-base font-extrabold">
            受取見込み {formatYen(payoutPreview.sellerPayoutYen)}
          </p>
          <p className="mt-1 text-xs text-ink-soft">
            取引完了時にウォレットへ加算されます（出金時は別途振込手数料）
          </p>
        </div>
      )}

      <label className="field">
        <span>応募期限（シリアルコード有効期限）</span>
        <input
          type="datetime-local"
          required
          min={minExpiry || undefined}
          value={serialExpiresLocal}
          onChange={(e) => setSerialExpiresLocal(e.target.value)}
        />
        <span className="mt-1.5 block text-xs leading-relaxed text-ink-soft">
          {EXPIRY_NOTE}
        </span>
      </label>

      <label className="field">
        <span>
          シリアルコード（1行1件）
          {listingType === "SET"
            ? ` · セット枚数と一致させてください（現在 ${codes.length} / ${setQuantity}）`
            : ` · 現在 ${codes.length} 件`}
        </span>
        <textarea
          required
          rows={8}
          value={codesText}
          onChange={(e) => setCodesText(e.target.value)}
          placeholder={"ABCD-1111-2222\nABCD-3333-4444"}
          spellCheck={false}
        />
      </label>

      {listingType === "INVENTORY" && (
        <fieldset className="mb-4">
          <label className="flex items-start gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={bulkOn}
              onChange={(e) => setBulkOn(e.target.checked)}
            />
            <span>
              まとめ買い割引を設定する
              <span className="mt-1 block font-normal leading-relaxed text-ink-soft">
                一度にたくさん買う人向けの割引です。例えば「10枚以上で10%引き」のように設定できます。
              </span>
            </span>
          </label>
          {bulkOn && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="field">
                <span>何枚以上で割引するか</span>
                <input
                  type="number"
                  min={2}
                  value={bulkMin}
                  onChange={(e) => setBulkMin(Number(e.target.value))}
                />
              </label>
              <label className="field">
                <span>何％引きにするか</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={bulkPct}
                  onChange={(e) => setBulkPct(Number(e.target.value))}
                />
              </label>
            </div>
          )}
        </fieldset>
      )}

      {error && isLoginRequiredError(error) && (
        <div className="space-y-2">
          <p className="banner-error !mb-0">{error}</p>
          <Link href="/auth" className="btn btn-primary btn-block">
            LINEでログイン
          </Link>
        </div>
      )}
      {error && !isLoginRequiredError(error) && (
        <p className="banner-error">{error}</p>
      )}
      {message && <p className="banner-ok">{message}</p>}

      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy ? "出品中…" : "出品する"}
      </button>
    </form>
  );
}
