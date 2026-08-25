"use client";

import { formatYen } from "@/lib/format";
import { ME_PREVIEW_LIMIT, MoreLink } from "@/components/wallet/MeListHelpers";

type LedgerRow = {
  id: string;
  type: string;
  amountYen: number;
  createdAt: string;
  description: string | null;
};

type PayoutRow = {
  id: string;
  amountYen: number;
  feeYen: number;
  status: string;
  createdAt: string;
};

export function WalletHistoryCard({
  recent,
  payouts,
  previewLimit,
  moreHref = "/me/wallet",
}: {
  recent: LedgerRow[];
  payouts: PayoutRow[];
  previewLimit?: number;
  moreHref?: string;
}) {
  const recentVisible =
    typeof previewLimit === "number"
      ? recent.slice(0, previewLimit)
      : recent;
  const payoutVisible =
    typeof previewLimit === "number"
      ? payouts.slice(0, previewLimit)
      : payouts;
  const moreTotal = Math.max(recent.length, payouts.length);

  return (
    <div className="space-y-4">
      <section className="card-surface">
        <h2 className="me-section-title">最近の残高履歴</h2>
        <ul className="mt-3 divide-y divide-ink/10">
          {recent.length === 0 && (
            <li className="py-3 text-sm text-ink-soft">まだ履歴はありません</li>
          )}
          {recentVisible.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between py-3 text-sm"
            >
              <div>
                <p className="me-item-title">{row.description ?? row.type}</p>
                <p className="me-item-meta">
                  {new Date(row.createdAt).toLocaleString("ja-JP")}
                </p>
              </div>
              <p
                className={`font-mono font-semibold ${
                  row.amountYen >= 0 ? "text-mint-deep" : "text-coral"
                }`}
              >
                {row.amountYen >= 0 ? "+" : ""}
                {formatYen(row.amountYen)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card-surface">
        <h2 className="me-section-title">出金申請</h2>
        <ul className="mt-3 divide-y divide-ink/10">
          {payouts.length === 0 && (
            <li className="py-3 text-sm text-ink-soft">申請履歴なし</li>
          )}
          {payoutVisible.map((p) => (
            <li key={p.id} className="flex justify-between py-3 text-sm">
              <div>
                <p className="me-item-title">{formatYen(p.amountYen)}</p>
                <p className="me-item-meta">
                  手数料 {formatYen(p.feeYen)} · {p.status}
                </p>
              </div>
              <p className="text-xs text-ink-soft">
                {new Date(p.createdAt).toLocaleDateString("ja-JP")}
              </p>
            </li>
          ))}
        </ul>
        {typeof previewLimit === "number" && (
          <div className="mt-2">
            <MoreLink
              href={moreHref}
              total={moreTotal}
              limit={previewLimit || ME_PREVIEW_LIMIT}
            />
          </div>
        )}
      </section>
    </div>
  );
}
