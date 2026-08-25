"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatRemainingUntil, formatYen } from "@/lib/format";
import { apiFetch } from "@/lib/auth/fetch";
import { ME_PREVIEW_LIMIT, MoreLink } from "@/components/wallet/MeListHelpers";

type Purchase = {
  id: string;
  status: string;
  awaitingPayment?: boolean;
  awaitingReveal: boolean;
  awaitingRating?: boolean;
  confirmationTimerPaused?: boolean;
  quantity: number;
  amountChargedYen: number;
  codeRevealedAt: string | null;
  revealDeadlineAt: string | null;
  reservedUntil?: string | null;
  confirmationDeadlineAt: string | null;
  createdAt: string;
  itemTitle: string;
  artistName: string | null;
  eventName: string | null;
};

function formatDeadline(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PendingPurchasesCard({
  initialPurchases,
  previewLimit,
  moreHref = "/me/purchases",
}: {
  initialPurchases?: Purchase[] | null;
  previewLimit?: number;
  moreHref?: string;
}) {
  const [purchases, setPurchases] = useState<Purchase[] | null>(
    initialPurchases ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/purchases");
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setPurchases([]);
          return;
        }
        throw new Error(json.error ?? "取得に失敗しました");
      }
      setPurchases(json.purchases ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  }, []);

  useEffect(() => {
    if (initialPurchases) return;
    void load();
  }, [initialPurchases, load]);

  // 残り時間表示を更新
  useEffect(() => {
    const id = window.setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  if (error) {
    return <p className="banner-error">{error}</p>;
  }

  if (!purchases) {
    return (
      <section className="card-surface">
        <p className="text-sm text-ink-soft">購入履歴を読み込み中…</p>
      </section>
    );
  }

  const shown =
    typeof previewLimit === "number"
      ? purchases.slice(0, previewLimit)
      : purchases;
  const awaitingPayment = shown.filter((p) => p.awaitingPayment);
  const pendingReveal = shown.filter(
    (p) => !p.awaitingPayment && p.awaitingReveal,
  );
  const inWindow = shown.filter(
    (p) => !p.awaitingPayment && !p.awaitingReveal,
  );

  void nowTick; // 再レンダー用

  return (
    <section className="card-surface space-y-4">
      <div>
        <h2 className="me-section-title">開示前・確認中のシリアル</h2>
        <p className="me-section-desc">
          購入後のキャンセルはできません。開示は72時間まで保留できますが、過ぎると返金なしで取引完了・評価★1になります。決済途中で止めた場合は約30分で在庫に戻ります。
        </p>
      </div>

      {purchases.length === 0 && (
        <p className="text-sm text-ink-soft">現在、開示待ちの購入はありません</p>
      )}

      {awaitingPayment.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-coral">
            支払い待ち
          </p>
          <ul className="divide-y divide-ink/10">
            {awaitingPayment.map((p) => {
              const until = formatDeadline(p.reservedUntil ?? null);
              const remaining = formatRemainingUntil(p.reservedUntil ?? null);
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
                    <p className="me-item-meta">
                      {p.quantity}枚 · {formatYen(p.amountChargedYen)} · 未決済
                      {remaining ? ` · ${remaining}` : ""}
                      {until ? `（${until}まで）` : ""}
                    </p>
                  </div>
                  <Link
                    href={`/checkout/${p.id}`}
                    className="btn btn-primary shrink-0 !px-3 !py-2 text-xs"
                  >
                    支払いを続ける
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {pendingReveal.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-coral">
            開示前（保留中）
          </p>
          <ul className="divide-y divide-ink/10">
            {pendingReveal.map((p) => {
              const until = formatDeadline(p.revealDeadlineAt);
              const remaining = formatRemainingUntil(p.revealDeadlineAt);
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
                    <p className="me-item-meta">
                      {p.quantity}枚 · {formatYen(p.amountChargedYen)} · 未開示
                    </p>
                    {remaining && (
                      <p className="mt-0.5 text-xs font-bold text-coral">
                        {remaining}
                        {until ? ` · ${until}まで` : ""}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/transactions/${p.id}`}
                    className="btn btn-primary shrink-0 !px-3 !py-2 text-xs"
                  >
                    開示する
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {inWindow.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-mint-deep">
            開示済み・確認中
          </p>
          <ul className="divide-y divide-ink/10">
            {inWindow.map((p) => {
              const until = formatDeadline(p.confirmationDeadlineAt);
              const remaining = p.confirmationTimerPaused
                ? null
                : formatRemainingUntil(p.confirmationDeadlineAt);
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
                    <p className="me-item-meta">
                      {p.quantity}枚 · {formatYen(p.amountChargedYen)}
                      {p.status === "DISPUTED"
                        ? " · 異議中（タイマー停止）"
                        : p.awaitingRating
                          ? " · 評価待ち（評価で完了）"
                          : p.confirmationTimerPaused
                            ? " · タイマー停止中"
                            : " · 確認中"}
                    </p>
                    {(remaining || p.confirmationTimerPaused) && (
                      <p
                        className={`mt-0.5 text-xs font-bold ${
                          p.confirmationTimerPaused
                            ? "text-ink-soft"
                            : "text-mint-deep"
                        }`}
                      >
                        {p.confirmationTimerPaused
                          ? "停止中"
                          : remaining}
                        {!p.confirmationTimerPaused && until
                          ? ` · ${until}まで`
                          : ""}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/transactions/${p.id}`}
                    className="btn btn-ghost shrink-0 !px-3 !py-2 text-xs"
                  >
                    開く
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {typeof previewLimit === "number" && (
        <MoreLink
          href={moreHref}
          total={purchases.length}
          limit={previewLimit || ME_PREVIEW_LIMIT}
        />
      )}
    </section>
  );
}
