import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getPublicItem } from "@/services/listing";
import { listSellerRatings } from "@/services/rating";
import { formatYen } from "@/lib/format";
import { isTrialListing } from "@/lib/trial-listing";
import {
  canSellOrBuyByExpiry,
  isPastSerialExpiry,
} from "@/lib/serial-expiry";
import { BuyPanel } from "@/components/listing/BuyPanel";
import { FavoriteButton } from "@/components/listing/FavoriteButton";
import { ListingComments } from "@/components/listing/ListingComments";
import { readSessionUserId } from "@/lib/auth/app-session";
import { prisma } from "@/lib/prisma";
import { isFavorited } from "@/services/favorites";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

function formatExpiryJa(d: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default async function ItemDetailPage({ params }: Props) {
  const { id } = await params;
  const item = await getPublicItem(id);
  if (!item) notFound();

  const cookieStore = await cookies();
  const sessionUserId = readSessionUserId(
    cookieStore
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join("; "),
  );

  let currentUser: {
    id: string;
    canBuy: boolean;
  } | null = null;
  let favorited: boolean | null = null;

  if (sessionUserId) {
    const user = await prisma.user.findUnique({
      where: { id: sessionUserId },
      select: {
        id: true,
        phoneVerified: true,
        ekycStatus: true,
        isSuspended: true,
      },
    });
    if (user && !user.isSuspended) {
      currentUser = {
        id: user.id,
        canBuy: user.phoneVerified && user.ekycStatus === "APPROVED",
      };
      favorited = await isFavorited(user.id, item.id);
    }
  }

  const sellerName = item.seller.displayName?.trim() || "出品者";
  const rating =
    item.seller.ratingCount > 0
      ? Number(item.seller.ratingScore.toString()).toFixed(1)
      : null;
  const initial = sellerName.slice(0, 1);
  const recentRatings = await listSellerRatings(item.seller.id, 5);
  const trial = isTrialListing(item);

  const purchaseBlocked = !canSellOrBuyByExpiry(item.serialExpiresAt);
  const pastExpiry = isPastSerialExpiry(item.serialExpiresAt);
  const saleEnded =
    pastExpiry || item.status === "SOLD_OUT" || purchaseBlocked;

  const canComment = Boolean(currentUser?.canBuy) && !trial;
  const commentsDisabledReason = trial
    ? "お試し出品にはコメントできません。"
    : null;

  return (
    <main className="space-y-4 pb-28 sm:pb-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex min-h-9 items-center text-xs font-bold text-ink-soft"
        >
          ← 一覧に戻る
        </Link>
        {!trial && (
          <FavoriteButton itemId={item.id} initialFavorited={favorited} />
        )}
      </div>

      <article className="card-surface space-y-4 !p-4 sm:!p-5">
        <div>
          {trial && (
            <p className="mb-2 inline-block rounded-md bg-mint/20 px-2 py-0.5 text-[11px] font-extrabold text-mint-deep">
              0円お試し
            </p>
          )}
          {saleEnded && !trial && (
            <p className="mb-2 inline-block rounded-md bg-ink/10 px-2 py-0.5 text-[11px] font-extrabold text-ink-soft">
              {pastExpiry || item.status === "SOLD_OUT"
                ? "売り切れ / 販売終了"
                : "販売終了"}
            </p>
          )}
          {item.artistName && (
            <p className="mb-1 text-[11px] font-extrabold tracking-wide text-mint-deep">
              {item.artistName}
            </p>
          )}
          <h1 className="text-xl font-extrabold leading-snug tracking-tight sm:text-2xl">
            {item.title}
          </h1>
          <p className="me-section-desc mt-1.5">
            {item.eventName ?? "イベント未設定"}
            {item.category ? ` · ${item.category}` : ""}
          </p>
          {item.serialExpiresAt && (
            <p className="me-item-meta mt-1.5 font-semibold">
              応募期限{" "}
              <time dateTime={item.serialExpiresAt.toISOString()}>
                {formatExpiryJa(item.serialExpiresAt)}
              </time>
            </p>
          )}
        </div>

        <section
          className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-ink/[0.03] px-3 py-2.5"
          aria-label="出品者情報"
        >
          <div
            className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-ink text-sm font-extrabold text-white"
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
              initial
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="me-item-meta font-bold tracking-wider">出品者</p>
            <p className="me-item-title truncate text-base">{sellerName}</p>
            <p className="me-item-meta">
              {rating
                ? `評価 ★${rating}（${item.seller.ratingCount}件）`
                : "評価はまだありません"}
              {" · "}
              売上 {item.seller.completedSales}件
              {item.seller.publicId ? ` · ${item.seller.publicId}` : ""}
            </p>
            <p className="me-item-meta">
              異議 受けた {item.seller.disputeCountAsSeller}件
              {" · "}
              出した {item.seller.disputeCountAsBuyer}件
            </p>
          </div>
          {item.seller.publicId && (
            <Link
              href={`/sellers/${item.seller.publicId}`}
              className="btn btn-ghost shrink-0 !px-2.5 !py-1.5 text-xs"
            >
              評価を見る
            </Link>
          )}
        </section>

        <div className="flex items-end justify-between gap-3 border-y border-ink/10 py-3">
          <div>
            <p className="me-item-meta font-bold tracking-wider">1枚あたり</p>
            <p className="font-mono text-2xl font-semibold sm:text-3xl">
              {trial ? "¥0" : formatYen(item.unitPriceYen)}
            </p>
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

        {recentRatings.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-bold">最近の評価</h2>
            <ul className="space-y-2">
              {recentRatings.map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm"
                >
                  <p className="font-semibold">
                    ★{r.score}{" "}
                    <span className="font-normal text-ink-soft">
                      · {r.raterName}
                    </span>
                  </p>
                  {r.comment && (
                    <p className="mt-1 text-ink-soft">{r.comment}</p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <BuyPanel
          itemId={item.id}
          title={item.title}
          listingType={item.listingType}
          unitPriceYen={item.unitPriceYen}
          stockAvailable={item.stockAvailable}
          setQuantity={item.setQuantity}
          status={item.status}
          confirmationWindowMinutes={item.confirmationWindowMinutes}
          purchaseBlocked={purchaseBlocked}
          saleEndedLabel={
            pastExpiry || item.status === "SOLD_OUT"
              ? "売り切れ / 販売終了"
              : "販売終了"
          }
        />
      </article>

      <ListingComments
        itemId={item.id}
        sellerId={item.seller.id}
        currentUserId={currentUser?.id ?? null}
        canComment={canComment}
        commentsDisabledReason={commentsDisabledReason}
      />
    </main>
  );
}
