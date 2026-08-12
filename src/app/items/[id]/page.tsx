import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicItem } from "@/services/listing";
import { formatYen } from "@/lib/format";
import { BuyPanel } from "@/components/listing/BuyPanel";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export default async function ItemDetailPage({ params }: Props) {
  const { id } = await params;
  const item = await getPublicItem(id);
  if (!item) notFound();

  const sellerName = item.seller.displayName?.trim() || "出品者";
  const rating =
    item.seller.ratingCount > 0
      ? Number(item.seller.ratingScore.toString()).toFixed(1)
      : null;
  const initial = sellerName.slice(0, 1);

  return (
    <main className="space-y-4 pb-28 sm:pb-4">
      <Link href="/" className="inline-flex min-h-10 items-center text-sm font-bold text-ink-soft">
        ← 一覧に戻る
      </Link>

      <article className="card-surface space-y-4 !p-4 sm:!p-6">
        <div>
          <p className="brand-mark">シリアルPay</p>
          {item.artistName && (
            <p className="mb-1 text-sm font-extrabold tracking-wide text-mint-deep">
              {item.artistName}
            </p>
          )}
          {/* 出品タイトル */}
          <h1 className="text-[1.35rem] font-extrabold leading-snug tracking-tight sm:text-3xl">
            {item.title}
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {item.eventName ?? "イベント未設定"}
            {item.category ? ` · ${item.category}` : ""}
          </p>
        </div>

        {/* 出品者ブロック（モバイルでもはっきり見える） */}
        <section
          className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-ink/[0.03] px-3 py-3"
          aria-label="出品者情報"
        >
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-base font-extrabold text-white"
            aria-hidden
          >
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-soft">
              出品者
            </p>
            <p className="truncate text-base font-extrabold">{sellerName}</p>
            <p className="text-xs font-semibold text-ink-soft">
              {rating
                ? `評価 ★${rating}（${item.seller.ratingCount}件）`
                : "評価まだなし"}
              {" · "}
              {item.listingType === "SET"
                ? `セット ${item.setQuantity ?? item.stockAvailable}枚`
                : `残り ${item.stockAvailable}枚`}
            </p>
          </div>
        </section>

        <div className="flex items-end justify-between gap-3 border-y border-ink/10 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
              1枚あたり
            </p>
            <p className="font-mono text-3xl font-semibold">
              {formatYen(item.unitPriceYen)}
            </p>
            {item.suggestedAvgPriceYen != null && (
              <p className="mt-1 text-xs text-ink-soft">
                相場めやす {formatYen(item.suggestedAvgPriceYen)}
              </p>
            )}
          </div>
        </div>

        {item.description && (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">
            {item.description}
          </p>
        )}

        {item.bulkDiscountEnabled &&
          item.bulkDiscountMinQty &&
          item.bulkDiscountPercent && (
            <p className="rounded-xl bg-mint/10 px-3 py-2 text-sm font-semibold text-mint-deep">
              {item.bulkDiscountMinQty}枚以上で {item.bulkDiscountPercent}% OFF
            </p>
          )}

        <BuyPanel
          itemId={item.id}
          listingType={item.listingType}
          unitPriceYen={item.unitPriceYen}
          stockAvailable={item.stockAvailable}
          setQuantity={item.setQuantity}
          status={item.status}
          confirmationWindowMinutes={item.confirmationWindowMinutes}
        />
      </article>
    </main>
  );
}
