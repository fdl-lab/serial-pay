"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatYen } from "@/lib/format";
import { calcPriceBreakdown } from "@/lib/money";
import { apiFetch } from "@/lib/auth/fetch";
import {
  fromDatetimeLocalValue,
  minDatetimeLocalValue,
  toDatetimeLocalValue,
} from "@/lib/serial-expiry";

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
  serialExpiresAt: string | null;
  isTrial: boolean;
};

type Props = {
  itemId: string;
};

const EXPIRY_NOTE =
  "※シリアルコードの応募締め切り日時（有効期限）を正確に選択してください。複数の期間がある場合は最後の期間の最終日時を入力してください。";

export function ListingEditForm({ itemId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<EditItem | null>(null);
  const [title, setTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [eventName, setEventName] = useState("");
  const [unitPriceYen, setUnitPriceYen] = useState("1200");
  const [serialExpiresLocal, setSerialExpiresLocal] = useState("");
  const [minExpiry, setMinExpiry] = useState("");
  const [addCodesText, setAddCodesText] = useState("");
  const [bulkOn, setBulkOn] = useState(false);
  const [bulkMin, setBulkMin] = useState(10);
  const [bulkPct, setBulkPct] = useState(10);
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

  const payoutPreview = useMemo(() => {
    const price = Number(unitPriceYen);
    if (!Number.isFinite(price) || price <= 0) return null;
    const qty =
      item?.listingType === "SET"
        ? Math.max(1, item.setQuantity || 1)
        : 1;
    return calcPriceBreakdown({
      unitPriceYen: Math.floor(price),
      quantity: qty,
      feePercent: 13,
    });
  }, [item?.listingType, item?.setQuantity, unitPriceYen]);

  useEffect(() => {
    setMinExpiry(minDatetimeLocalValue());
  }, []);

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
        setUnitPriceYen(String(row.unitPriceYen));
        setBulkOn(row.bulkDiscountEnabled);
        setBulkMin(row.bulkDiscountMinQty ?? 10);
        setBulkPct(row.bulkDiscountPercent ?? 10);
        if (row.serialExpiresAt) {
          setSerialExpiresLocal(
            toDatetimeLocalValue(new Date(row.serialExpiresAt)),
          );
        }
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

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!item) return;
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

      const res = await apiFetch(`/api/listings/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          artistName: artistName.trim(),
          eventName: eventName || null,
          unitPriceYen: priceYen,
          serialExpiresAt,
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
      const again = await apiFetch(`/api/listings/${itemId}`);
      const againJson = await again.json();
      if (again.ok) {
        setItem(againJson.item);
        if (againJson.item.serialExpiresAt) {
          setSerialExpiresLocal(
            toDatetimeLocalValue(new Date(againJson.item.serialExpiresAt)),
          );
        }
      }
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
      <header className="mb-5">
        <p className="brand-mark">シリアルPay</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          出品を編集
        </h1>
        <p className="me-section-desc">
          形式（バラ売り / セット）は変更できません。登録済みのシリアルは、あとから内容を確認できません。
        </p>
        <p className="me-item-meta mt-2 font-semibold">
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
        <span>イベント名・公演名（任意）</span>
        <input
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
        />
      </label>

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

      {payoutPreview && payoutPreview.amountChargedYen > 0 && (
        <div className="mb-4 rounded-xl border border-mint/30 bg-mint/10 px-3 py-3 text-sm leading-relaxed">
          <p className="font-bold text-mint-deep">売上の目安（販売手数料差引後）</p>
          <p className="mt-1 text-ink-soft">
            {item?.listingType === "SET"
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
