"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/auth/fetch";
import { ME_PREVIEW_LIMIT, MoreLink } from "@/components/wallet/MeListHelpers";

type InboxComment = {
  id: string;
  body: string;
  createdAt: string;
  parentId: string | null;
  item: { id: string; title: string };
  author?: {
    id: string;
    publicId: string | null;
    displayName: string | null;
  };
};

type Inbox = {
  onMyListings: InboxComment[];
  authored: InboxComment[];
};

export function ListingCommentsCard({
  initialInbox,
  previewLimit,
  moreHref = "/me/comments",
}: {
  initialInbox?: Inbox | null;
  previewLimit?: number;
  moreHref?: string;
}) {
  const [inbox, setInbox] = useState<Inbox | null>(initialInbox ?? null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/me/listing-comments");
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setInbox({ onMyListings: [], authored: [] });
          return;
        }
        throw new Error(json.error ?? "取得に失敗しました");
      }
      setInbox(json);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  }, []);

  useEffect(() => {
    if (initialInbox) return;
    void load();
  }, [initialInbox, load]);

  if (error) return <p className="banner-error">{error}</p>;

  if (!inbox) {
    return (
      <section className="card-surface">
        <p className="text-sm text-ink-soft">コメントを読み込み中…</p>
      </section>
    );
  }

  const onMy =
    typeof previewLimit === "number"
      ? inbox.onMyListings.slice(0, previewLimit)
      : inbox.onMyListings;
  const authored =
    typeof previewLimit === "number"
      ? inbox.authored.slice(0, previewLimit)
      : inbox.authored;

  return (
    <section className="card-surface space-y-4">
      <div>
        <h2 className="me-section-title">出品コメント</h2>
        <p className="me-section-desc">
          自分の出品への質問・自分が書いたコメント
        </p>
      </div>

      <div className="space-y-2">
        <h3 className="me-item-title">出品への新着</h3>
        {inbox.onMyListings.length === 0 ? (
          <p className="me-item-body">まだありません</p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {onMy.map((c) => (
              <li key={c.id} className="py-2.5">
                <Link
                  href={`/items/${c.item.id}#comments`}
                  className="me-item-title text-mint-deep underline"
                >
                  {c.item.title}
                </Link>
                <p className="me-item-body mt-1">
                  {c.author?.displayName ?? "ユーザー"}
                  {c.parentId ? "（返信）" : ""}: {c.body}
                </p>
                <p className="me-item-meta mt-1">
                  {new Date(c.createdAt).toLocaleString("ja-JP")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="me-item-title">自分が書いたコメント</h3>
        {inbox.authored.length === 0 ? (
          <p className="me-item-body">まだありません</p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {authored.map((c) => (
              <li key={c.id} className="py-2.5">
                <Link
                  href={`/items/${c.item.id}#comments`}
                  className="me-item-title text-mint-deep underline"
                >
                  {c.item.title}
                </Link>
                <p className="me-item-body mt-1">{c.body}</p>
                <p className="me-item-meta mt-1">
                  {new Date(c.createdAt).toLocaleString("ja-JP")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      {typeof previewLimit === "number" && (
        <MoreLink
          href={moreHref}
          total={Math.max(inbox.onMyListings.length, inbox.authored.length)}
          limit={previewLimit || ME_PREVIEW_LIMIT}
        />
      )}
    </section>
  );
}
