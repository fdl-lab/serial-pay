"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { formatYen } from "@/lib/format";
import { apiFetch } from "@/lib/auth/fetch";

type ListingType = "SET" | "INVENTORY";

type Props = {
  onCreated?: (itemId: string) => void;
};

export function ListingForm({ onCreated }: Props) {
  const [listingType, setListingType] = useState<ListingType>("INVENTORY");
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [eventName, setEventName] = useState("");
  const [unitPriceYen, setUnitPriceYen] = useState(1200);
  const [setQuantity, setSetQuantity] = useState(5);
  const [codesText, setCodesText] = useState("");
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

    const body = {
      title,
      artistName: artistName.trim(),
      eventName: eventName || undefined,
      listingType,
      unitPriceYen,
      setQuantity: listingType === "SET" ? setQuantity : undefined,
      serialCodes: codes,
      bulkDiscountEnabled: listingType === "INVENTORY" && bulkOn,
      bulkDiscountMinQty: bulkOn ? bulkMin : null,
      bulkDiscountPercent: bulkOn ? bulkPct : null,
      publish: true,
    };

    try {
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
      <header className="mb-6">
        <p className="brand-mark">シリアルPay</p>
        <h1 className="text-3xl font-extrabold tracking-tight">出品する</h1>
        <p className="mt-2 text-ink-soft">
          コードは暗号化して保存されます。平文はサーバーに残さない設計です。
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
        <span>イベント名（相場表示に使用）</span>
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
            required
            value={unitPriceYen}
            onChange={(e) => setUnitPriceYen(Number(e.target.value))}
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
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={bulkOn}
              onChange={(e) => setBulkOn(e.target.checked)}
            />
            大口割引を有効にする
          </label>
          {bulkOn && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="field">
                <span>この枚数以上</span>
                <input
                  type="number"
                  min={2}
                  value={bulkMin}
                  onChange={(e) => setBulkMin(Number(e.target.value))}
                />
              </label>
              <label className="field">
                <span>割引率（%）</span>
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

      {error && <p className="banner-error">{error}</p>}
      {message && <p className="banner-ok">{message}</p>}

      <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
        {busy ? "出品中…" : "暗号化して出品する"}
      </button>
    </form>
  );
}
