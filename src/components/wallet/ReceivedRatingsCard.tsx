"use client";

import Link from "next/link";
import { ME_PREVIEW_LIMIT, MoreLink } from "@/components/wallet/MeListHelpers";

type ReceivedRating = {
  id: string;
  score: number;
  comment: string | null;
  createdAt: string;
  raterName: string;
  raterPublicId: string | null;
  itemTitle: string;
};

export function ReceivedRatingsCard({
  initialRatings,
  previewLimit,
  moreHref = "/me/ratings",
}: {
  initialRatings: ReceivedRating[];
  previewLimit?: number;
  moreHref?: string;
}) {
  const visible =
    typeof previewLimit === "number"
      ? initialRatings.slice(0, previewLimit)
      : initialRatings;

  return (
    <section className="card-surface space-y-4">
      <div>
        <h2 className="me-section-title">受け取った評価</h2>
        <p className="me-section-desc">取引相手から届いた評価の一覧です</p>
      </div>

      {initialRatings.length === 0 ? (
        <p className="text-sm text-ink-soft">まだ評価はありません</p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {visible.map((r) => (
            <li key={r.id} className="py-3">
              <p className="me-item-title">
                ★{r.score}{" "}
                <span className="me-item-meta font-normal">
                  · {r.raterName}
                  {r.raterPublicId ? (
                    <>
                      {" · "}
                      <Link
                        href={`/sellers/${r.raterPublicId}`}
                        className="font-mono text-mint-deep underline-offset-2 hover:underline"
                      >
                        {r.raterPublicId}
                      </Link>
                    </>
                  ) : null}
                </span>
              </p>
              <p className="me-item-meta mt-0.5">{r.itemTitle}</p>
              {r.comment && (
                <p className="me-item-body mt-1">{r.comment}</p>
              )}
              <p className="me-item-meta mt-1">
                {new Date(r.createdAt).toLocaleDateString("ja-JP")}
              </p>
            </li>
          ))}
        </ul>
      )}
      {typeof previewLimit === "number" && (
        <MoreLink
          href={moreHref}
          total={initialRatings.length}
          limit={previewLimit || ME_PREVIEW_LIMIT}
        />
      )}
    </section>
  );
}
