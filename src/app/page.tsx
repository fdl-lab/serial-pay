import Link from "next/link";
import { Suspense } from "react";
import { listPublicItems } from "@/services/listing";
import { ItemList } from "@/components/listing/ItemList";
import { ListingSearchBar } from "@/components/listing/ListingSearchBar";

export const dynamic = "force-dynamic";

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
          <h1 className="text-[1.75rem] font-extrabold tracking-tight sm:text-4xl">
            出品一覧
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            即時開示・エスクロー対応のシリアル
          </p>
        </div>
        <Link
          href="/sell"
          className="btn btn-primary !min-h-11 !px-3.5 !py-2 text-sm sm:!px-4"
        >
          出品
        </Link>
      </header>

      <Suspense
        fallback={
          <div className="min-h-12 animate-pulse rounded-xl bg-ink/5" />
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
          <p className="text-xs font-semibold text-ink-soft">
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
