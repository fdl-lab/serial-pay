"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatYen } from "@/lib/format";
import { apiFetch } from "@/lib/auth/fetch";

type ListingType = "SET" | "INVENTORY";

type EditItem = {
  id: string;
  title: string;
  description: string | null;
  artistName: string | null;
  eventName: string | null;
  category: string | null;
  listingType: ListingType;
  unitPriceYen: number;
  setQuantity: number | null;
  stockAvailable: number;
  stockTotal: number;
  status: string;
  bulkDiscountEnabled: boolean;
  bulkDiscountMinQty: number | null;
  bulkDiscountPercent: number | null;
  isTrial: boolean;
};

type Props = {
  itemId: string;
};

export function ListingEditForm({ itemId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<EditItem | null>(null);
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [eventName, setEventName] = useState("");
  const [unitPriceYen, setUnitPriceYen] = useState(1200);
  const [addCodesText, setAddCodesText] = useState("");
  const [bulkOn, setBulkOn] = useState(false);
  const [bulkMin, setBulkMin] = useState(10);
  const [bulkPct, setBulkPct] = useState(10);
  const [marketAvg, setMarketAvg] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addCodes = useMemo(
    () =>
      addCodesText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    [addCodesText],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/listings/${itemId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "取得に失敗しました");
        if (cancelled) return;
        const row = json.item as EditItem;
        setItem(row);
        setTitle(row.title);
        setArtistName(row.artistName ?? "");
        setEventName(row.eventName ?? "");
        setUnitPriceYen(row.unitPriceYen);
        setBulkOn(row.bulkDiscountEnabled);
        setBulkMin(row.bulkDiscountMinQty ?? 10);
        setBulkPct(row.bulkDiscountPercent ?? 10);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "エラー");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId]);

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
    if (!item) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await apiFetch(`/api/listings/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          artistName: artistName.trim(),
          eventName: eventName || null,
          unitPriceYen,
          bulkDiscountEnabled: item.listingType === "INVENTORY" && bulkOn,
          bulkDiscountMinQty: bulkOn ? bulkMin : null,
          bulkDiscountPercent: bulkOn ? bulkPct : null,
          addSerialCodes:
            item.listingType === "INVENTORY" && addCodes.length > 0
              ? addCodes
              : undefined,
          publish: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "更新に失敗しました");
      setMessage("出品内容を更新しました");
      setAddCodesText("");
      router.refresh();
      // reload stock numbers
      const again = await apiFetch(`/api/listings/${itemId}`);
      const againJson = await again.json();
      if (again.ok) setItem(againJson.item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="card-surface">
        <p className="text-sm text-ink-soft">出品情報を読み込み中…</p>
      </section>
    );
  }

  if (!item) {
    return (
      <section className="card-surface space-y-3">
        <p className="banner-error">{error ?? "出品が見つかりません"}</p>
        <Link href="/me" className="btn btn-ghost">
          マイページへ戻る
        </Link>
      </section>
    );
  }

  if (item.isTrial) {
    return (
      <section className="card-surface space-y-3">
        <p className="banner-error">お試し出品は編集できません</p>
        <Link href="/me" className="btn btn-ghost">
          マイページへ戻る
        </Link>
      </section>
    );
  }

  return (
    <form className="card-surface" onSubmit={submit}>
      <header className="mb-6">
        <p className="brand-mark">シリアルPay</p>
        <h1 className="text-3xl font-extrabold tracking-tight">出品を編集</h1>
        <p className="mt-2 text-ink-soft">
          形式（バラ売り / セット）は変更できません。登録済みシリアルの平文は再表示できません。
        </p>
        <p className="mt-2 text-sm font-semibold text-ink-soft">
          現在の在庫 {item.stockAvailable} / {item.stockTotal} 枚 ·{" "}
          {item.listingType === "SET" ? "セット販売" : "バラ売り"}
        </p>
      </header>

      <label className="field">
        <span>タイトル</span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <label className="field">
        <span>アーティスト名</span>
        <input
          required
          value={artistName}
          onChange={(e) => setArtistName(e.target.value)}
        />
      </label>

      <label className="field">
        <span>イベント名（相場表示に使用）</span>
        <input
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
        />
      </label>

      {marketAvg != null && (
        <p className="mb-4 rounded-xl border border-dashed border-mint-deep/40 bg-mint/10 px-3 py-2 text-sm">
          直近の平均相場めやす: <strong>{formatYen(marketAvg)}</strong> / 枚
        </p>
      )}

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

      {item.listingType === "INVENTORY" && (
        <label className="field">
          <span>シリアルコードを追加（1行1件・任意）</span>
          <textarea
            rows={6}
            value={addCodesText}
            onChange={(e) => setAddCodesText(e.target.value)}
            placeholder={"追加分だけ入力\nABCD-5555-6666"}
            spellCheck={false}
          />
          <span className="mt-1 block text-xs text-ink-soft">
            追加予定 {addCodes.length} 件
          </span>
        </label>
      )}

      {item.listingType === "INVENTORY" && (
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

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          className="btn btn-primary btn-block sm:flex-1"
          disabled={busy}
        >
          {busy ? "更新中…" : "変更を保存"}
        </button>
        <Link href="/me" className="btn btn-ghost btn-block sm:flex-1">
          マイページへ戻る
        </Link>
      </div>
    </form>
  );
}
