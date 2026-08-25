import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { listPublicItems } from "@/services/listing";
import { ItemList } from "@/components/listing/ItemList";
import { ListingSearchBar } from "@/components/listing/ListingSearchBar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "出品一覧",
  description: "推し活特化型 応募用シリアルコード譲渡プラットフォーム",
  openGraph: {
    title: "出品一覧 | シリアルPay",
    description: "推し活特化型 応募用シリアルコード譲渡プラットフォーム",
  },
};

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function HomePage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() || undefined;

  let items: Awaited<ReturnType<typeof listPublicItems>> = [];
  let loadError = false;

  try {
    items = await listPublicItems({ q: query });
  } catch {
    loadError = true;
  }

  return (
    <main className="space-y-4 sm:space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="brand-mark">シリアルPay</p>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            出品一覧
          </h1>
          <p className="me-section-desc">
            推し活特化型 応募用シリアルコード譲渡プラットフォームです。シリアルコード暗号化・代金一時預かり・コード即時開示で安心安全な取引が可能です。詳しくは
            <Link
              href="/guide"
              className="font-semibold text-mint-deep underline-offset-2 hover:underline"
            >
              ご利用ガイド
            </Link>
            をご覧ください。
          </p>
        </div>
        <Link
          href="/sell"
          className="btn btn-primary !min-h-10 !px-3.5 !py-2 text-xs sm:!px-4"
        >
          出品
        </Link>
      </header>

      <Suspense
        fallback={
          <div className="min-h-10 animate-pulse rounded-xl bg-ink/5" />
        }
      >
        <ListingSearchBar />
      </Suspense>

      {loadError ? (
        <p className="banner-error">
          一覧の取得に失敗しました。少し待ってから再読み込みしてください。
        </p>
      ) : (
        <>
          <p className="me-item-meta font-semibold">
            {query ? (
              <>
                「{query}」の検索結果 · {items.length} 件
              </>
            ) : (
              <>{items.length} 件の出品</>
            )}
          </p>
          <ItemList
            items={items}
            emptyTitle={
              query ? "見つかりませんでした" : "まだ出品がありません"
            }
            emptyDescription={
              query
                ? "別のキーワードでお試しください"
                : "最初のシリアルを出品してみてください"
            }
          />
        </>
      )}
    </main>
  );
}
