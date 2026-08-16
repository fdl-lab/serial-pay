import Link from "next/link";
import { formatYen } from "@/lib/format";
import { isTrialListing } from "@/lib/trial-listing";

export type ListingListItem = {
  id: string;
  title: string;
  artistName: string | null;
  eventName: string | null;
  category: string | null;
  listingType: "SET" | "INVENTORY";
  unitPriceYen: number;
  stockAvailable: number;
  setQuantity: number | null;
  bulkDiscountEnabled: boolean;
  bulkDiscountMinQty: number | null;
  bulkDiscountPercent: number | null;
  suggestedAvgPriceYen: number | null;
  seller: {
    publicId?: string | null;
    displayName: string | null;
    avatarUrl?: string | null;
    ratingScore: { toString(): string } | number | string;
    ratingCount: number;
  };
};

type Props = {
  items: ListingListItem[];
  emptyTitle?: string;
  emptyDescription?: string;
};

function ratingText(score: ListingListItem["seller"]["ratingScore"]) {
  const n = typeof score === "number" ? score : Number(score.toString());
  return Number.isFinite(n) ? n.toFixed(1) : null;
}

function sellerInitial(name: string) {
  return name.trim().slice(0, 1) || "出";
}

export function ItemList({
  items,
  emptyTitle = "まだ出品がありません",
  emptyDescription = "最初のシリアルを出品してみましょう",
}: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/20 bg-white/60 px-5 py-12 text-center">
        <p className="text-lg font-bold">{emptyTitle}</p>
        <p className="mt-2 text-sm text-ink-soft">{emptyDescription}</p>
        {!emptyTitle.includes("見つから") && (
          <a href="/sell" className="btn btn-primary mt-5 inline-flex min-h-12">
            出品する
          </a>
        )}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-white/90 shadow-[0_18px_50px_rgba(18,21,28,0.06)]">
      {items.map((item) => {
        const sellerName = item.seller.displayName?.trim() || "出品者";
        const rating = item.seller.ratingCount > 0 ? ratingText(item.seller.ratingScore) : null;
        const trial = isTrialListing(item);
        const typeLabel = trial
          ? "無料でお試しできます"
          : item.listingType === "SET"
            ? `セット ${item.setQuantity ?? item.stockAvailable}枚`
            : `在庫 ${item.stockAvailable}枚 · バラ可`;

        return (
          <li
            key={item.id}
            className={trial ? "bg-mint/15" : undefined}
          >
            <Link
              href={`/items/${item.id}`}
              className={`flex min-h-[88px] items-stretch gap-3 px-3 py-3.5 transition sm:gap-4 sm:px-5 sm:py-4 ${
                trial
                  ? "active:bg-mint/25"
                  : "active:bg-mint/10"
              }`}
            >
              {/* 出品者アバター */}
              <div
                className="relative flex h-11 w-11 shrink-0 items-center justify-center self-center overflow-hidden rounded-full bg-ink text-sm font-extrabold text-white sm:h-12 sm:w-12"
                aria-hidden
              >
                {item.seller.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.seller.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  sellerInitial(sellerName)
                )}
              </div>

              <div className="min-w-0 flex-1">
                {/* アーティスト名 */}
                {item.artistName && (
                  <p className="mb-0.5 truncate text-xs font-extrabold tracking-wide text-mint-deep sm:text-[13px]">
                    {item.artistName}
                  </p>
                )}

                {/* 出品タイトル（メイン） */}
                <p className="line-clamp-2 text-[15px] font-bold leading-snug tracking-tight sm:text-base">
                  {item.title}
                </p>

                {/* 出品者名を明示 */}
                <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px]">
                  <span className="rounded-md bg-ink/5 px-1.5 py-0.5 text-[11px] font-bold text-ink-soft">
                    出品者
                  </span>
                  <span className="font-bold text-ink">{sellerName}</span>
                  {rating && (
                    <span className="font-semibold text-ink-soft">★{rating}</span>
                  )}
                  {item.seller.publicId && (
                    <span className="font-mono text-[11px] text-ink-soft">
                      {item.seller.publicId}
                    </span>
                  )}
                </p>

                <p className="mt-1 truncate text-xs text-ink-soft sm:text-[13px]">
                  {item.eventName ?? "イベント未設定"}
                  {item.category ? ` · ${item.category}` : ""}
                  {" · "}
                  {typeLabel}
                </p>
              </div>

              <div className="flex shrink-0 flex-col items-end justify-center self-center pl-1">
                {trial ? (
                  <>
                    <p className="rounded-md bg-mint/20 px-1.5 py-0.5 text-[11px] font-extrabold text-mint-deep">
                      お試し
                    </p>
                    <p className="mt-1 font-mono text-[15px] font-semibold tracking-tight sm:text-base">
                      ¥0
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-mono text-[15px] font-semibold tracking-tight sm:text-base">
                      {formatYen(item.unitPriceYen)}
                    </p>
                    <p className="text-[11px] font-semibold text-ink-soft">/ 枚</p>
                  </>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
