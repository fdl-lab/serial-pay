import Link from "next/link";
import { formatRemainingUntil, formatYen } from "@/lib/format";
import { isTrialListing } from "@/lib/trial-listing";
import { FavoriteButton } from "@/components/listing/FavoriteButton";

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
  serialExpiresAt?: string | Date | null;
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
      <div className="rounded-2xl border border-dashed border-ink/20 bg-white/60 px-5 py-10 text-center">
        <p className="me-item-title text-base">{emptyTitle}</p>
        <p className="me-section-desc mt-2">{emptyDescription}</p>
        {!emptyTitle.includes("見つから") && (
          <a
            href="/sell"
            className="btn btn-primary mt-4 inline-flex !min-h-10 !px-4 text-xs"
          >
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
        const rating =
          item.seller.ratingCount > 0
            ? ratingText(item.seller.ratingScore)
            : null;
        const trial = isTrialListing(item);
        const typeLabel = trial
          ? "LINEログインだけで無料体験できます"
          : item.listingType === "SET"
            ? `セット ${item.setQuantity ?? item.stockAvailable}枚`
            : `在庫 ${item.stockAvailable}枚 · バラ可`;

        const avatar = item.seller.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.seller.avatarUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          sellerInitial(sellerName)
        );

        return (
          <li key={item.id} className={trial ? "bg-mint/15" : undefined}>
            <div className="flex items-stretch">
              <div
                className={`flex min-h-[76px] min-w-0 flex-1 items-stretch gap-2.5 px-3 py-3 sm:gap-3 sm:px-4 ${
                  trial ? "active:bg-mint/25" : ""
                }`}
              >
                {item.seller.publicId ? (
                  <Link
                    href={`/sellers/${item.seller.publicId}`}
                    className="relative flex h-10 w-10 shrink-0 items-center justify-center self-center overflow-hidden rounded-full bg-ink text-xs font-extrabold text-white sm:h-11 sm:w-11"
                    aria-label={`${sellerName}の出品ページ`}
                  >
                    {avatar}
                  </Link>
                ) : (
                  <div
                    className="relative flex h-10 w-10 shrink-0 items-center justify-center self-center overflow-hidden rounded-full bg-ink text-xs font-extrabold text-white sm:h-11 sm:w-11"
                    aria-hidden
                  >
                    {avatar}
                  </div>
                )}

                <Link
                  href={`/items/${item.id}`}
                  className={`flex min-w-0 flex-1 items-stretch gap-2.5 transition ${
                    trial ? "active:opacity-90" : "active:bg-mint/10"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    {item.artistName && (
                      <p className="mb-0.5 truncate text-[11px] font-extrabold tracking-wide text-mint-deep">
                        {item.artistName}
                      </p>
                    )}
                    <p className="me-item-title line-clamp-2">{item.title}</p>
                    <p className="me-item-meta mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <span className="rounded bg-ink/5 px-1 py-px text-[10px] font-bold">
                        出品者
                      </span>
                      <span className="font-bold text-ink">{sellerName}</span>
                      {rating && (
                        <span className="font-semibold">★{rating}</span>
                      )}
                      {item.seller.publicId && (
                        <span className="font-mono text-[10px]">
                          {item.seller.publicId}
                        </span>
                      )}
                    </p>
                    <p className="me-item-body mt-0.5 truncate">
                      {item.eventName ?? "イベント未設定"}
                      {item.category ? ` · ${item.category}` : ""}
                      {" · "}
                      {typeLabel}
                    </p>
                    {!trial &&
                      item.serialExpiresAt &&
                      (() => {
                        const remaining = formatRemainingUntil(
                          item.serialExpiresAt,
                        );
                        return remaining ? (
                          <p className="me-item-meta mt-0.5 font-bold text-coral">
                            応募期限 {remaining}
                          </p>
                        ) : null;
                      })()}
                  </div>

                  <div className="flex shrink-0 flex-col items-end justify-center self-center pl-1">
                    {trial ? (
                      <>
                        <p className="rounded bg-mint/20 px-1.5 py-0.5 text-[10px] font-extrabold text-mint-deep">
                          お試し
                        </p>
                        <p className="mt-1 font-mono text-sm font-semibold tracking-tight">
                          ¥0
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-mono text-sm font-semibold tracking-tight">
                          {formatYen(item.unitPriceYen)}
                        </p>
                        <p className="me-item-meta font-semibold">/ 枚</p>
                      </>
                    )}
                  </div>
                </Link>
              </div>
              {!trial && (
                <div className="flex items-center pr-2 sm:pr-3">
                  <FavoriteButton
                    itemId={item.id}
                    compact
                    className="!min-h-9 !px-2 !text-xs"
                  />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
