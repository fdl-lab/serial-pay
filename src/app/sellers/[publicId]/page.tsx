import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicSellerProfile } from "@/services/rating";
import { ItemList } from "@/components/listing/ItemList";

type Props = { params: Promise<{ publicId: string }> };

export const dynamic = "force-dynamic";

export default async function SellerProfilePage({ params }: Props) {
  const { publicId } = await params;
  const seller = await getPublicSellerProfile(publicId);
  if (!seller) notFound();

  const name = seller.displayName?.trim() || "出品者";
  const rating =
    seller.ratingCount > 0 ? seller.ratingScore.toFixed(1) : null;
  const initial = name.slice(0, 1);

  return (
    <main className="space-y-4 pb-28 sm:pb-4">
      <Link
        href="/"
        className="inline-flex min-h-10 items-center text-sm font-bold text-ink-soft"
      >
        ← 一覧に戻る
      </Link>

      <section className="card-surface space-y-4">
        <p className="brand-mark">シリアルPay</p>
        <div className="flex items-center gap-4">
          <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-ink text-xl font-extrabold text-white">
            {seller.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={seller.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              initial
            )}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">{name}</h1>
            <p className="font-mono text-sm text-ink-soft">{seller.publicId}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {rating
                ? `評価 ★${rating}（${seller.ratingCount}件）`
                : "評価はまだありません"}
              {" · "}
              売上 {seller.completedSales}件
            </p>
            <p className="mt-0.5 text-sm text-ink-soft">
              異議申し立て 受けた {seller.disputeCountAsSeller}件
              {" · "}
              出した {seller.disputeCountAsBuyer}件
            </p>
          </div>
        </div>

        <p className="rounded-xl bg-ink/5 px-3 py-2 text-xs text-ink-soft">
          公開IDは変更できません。名前や画像が変わっても、同じ人かどうかの目印になります。
        </p>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 px-1">
          <h2 className="text-lg font-bold">出品中</h2>
          <p className="text-xs text-ink-soft">{seller.listings.length}件</p>
        </div>
        {seller.listings.length === 0 ? (
          <section className="card-surface">
            <p className="text-sm text-ink-soft">いま公開中の出品はありません</p>
          </section>
        ) : (
          <ItemList items={seller.listings} />
        )}
      </section>

      <section className="card-surface space-y-3">
        <h2 className="text-lg font-bold">評価一覧</h2>
        {seller.ratings.length === 0 ? (
          <p className="text-sm text-ink-soft">まだ評価はありません</p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {seller.ratings.map((r) => (
              <li key={r.id} className="py-3">
                <p className="font-semibold">
                  ★{r.score}{" "}
                  <span className="text-sm font-normal text-ink-soft">
                    · {r.raterName}
                    {r.raterPublicId ? ` · ${r.raterPublicId}` : ""}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-ink-soft">{r.itemTitle}</p>
                {r.comment && (
                  <p className="mt-1 text-sm text-ink-soft">{r.comment}</p>
                )}
                <p className="mt-1 text-xs text-ink-soft">
                  {new Date(r.createdAt).toLocaleDateString("ja-JP")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
