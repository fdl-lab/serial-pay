"use client";

import Link from "next/link";
import { formatYen } from "@/lib/format";
import { ME_PREVIEW_LIMIT, MoreLink } from "@/components/wallet/MeListHelpers";

type HistoryItem = {
  id: string;
  status: string;
  quantity: number;
  amountChargedYen: number;
  codeRevealedAt: string | null;
  createdAt: string;
  completedAt: string;
  itemTitle: string;
  artistName: string | null;
  eventName: string | null;
  seller: {
    publicId: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };
};

export function PurchaseHistoryCard({
  initialHistory,
  previewLimit,
  moreHref = "/me/purchases",
}: {
  initialHistory: HistoryItem[];
  previewLimit?: number;
  moreHref?: string;
}) {
  const visible =
    typeof previewLimit === "number"
      ? initialHistory.slice(0, previewLimit)
      : initialHistory;

  return (
    <section className="card-surface space-y-4">
      <div>
        <h2 className="me-section-title">過去に購入したシリアル</h2>
        <p className="me-section-desc">
          完了した取引のコードは、ここからいつでも再表示できます
        </p>
      </div>

      {initialHistory.length === 0 ? (
        <p className="text-sm text-ink-soft">まだ完了した購入はありません</p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {visible.map((p) => {
            const sellerName = p.seller.displayName?.trim() || "出品者";
            return (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="me-item-title truncate">
                    {p.artistName ? `${p.artistName} · ` : ""}
                    {p.itemTitle}
                  </p>
                  <p className="me-item-meta mt-0.5">
                    {p.quantity}枚 · {formatYen(p.amountChargedYen)}
                    {p.status === "REFUNDED" ? " · 返金済み" : " · 完了"}
                    {" · "}
                    {new Date(p.completedAt).toLocaleDateString("ja-JP")}
                  </p>
                  <p className="me-item-meta mt-1 flex flex-wrap items-center gap-x-2">
                    <span>相手: {sellerName}</span>
                    {p.seller.publicId && (
                      <Link
                        href={`/sellers/${p.seller.publicId}`}
                        className="font-mono font-semibold text-mint-deep underline-offset-2 hover:underline"
                      >
                        {p.seller.publicId}
                      </Link>
                    )}
                  </p>
                </div>
                <Link
                  href={`/transactions/${p.id}`}
                  className="btn btn-ghost shrink-0 !px-3 !py-2 text-xs"
                >
                  シリアルを見る
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {typeof previewLimit === "number" && (
        <MoreLink
          href={moreHref}
          total={initialHistory.length}
          limit={previewLimit || ME_PREVIEW_LIMIT}
        />
      )}
    </section>
  );
}
