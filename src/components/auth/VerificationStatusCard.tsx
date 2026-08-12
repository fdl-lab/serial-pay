"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/auth/fetch";
import type { VerificationStatus } from "@/types/auth";

const EKYC_LABEL: Record<string, string> = {
  PENDING: "未提出",
  SUBMITTED: "審査中",
  APPROVED: "完了",
  REJECTED: "却下",
};

export function VerificationStatusCard() {
  const [user, setUser] = useState<VerificationStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/auth/me");
      const json = await res.json();
      if (!res.ok) {
        setUser(null);
        return;
      }
      setUser(json.user);
      setError(null);
    } catch {
      setError("認証状態の取得に失敗しました");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return <p className="banner-error">{error}</p>;
  }

  if (!user) {
    return (
      <section className="card-surface">
        <p className="text-sm text-ink-soft">認証状態を確認中…</p>
        <Link href="/auth" className="btn btn-primary mt-3">
          SMSログイン
        </Link>
      </section>
    );
  }

  return (
    <section className="card-surface">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink-soft">アカウント</p>
          <p className="font-bold">{user.displayName ?? "ユーザー"}</p>
        </div>
        {user.canBuy ? (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800">
            利用可能
          </span>
        ) : (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
            要確認
          </span>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-ink/5 px-3 py-2">
          <dt className="text-ink-soft">SMS</dt>
          <dd className="font-semibold">{user.phoneVerified ? "完了" : "未完了"}</dd>
        </div>
        <div className="rounded-xl bg-ink/5 px-3 py-2">
          <dt className="text-ink-soft">eKYC</dt>
          <dd className="font-semibold">{EKYC_LABEL[user.ekycStatus] ?? user.ekycStatus}</dd>
        </div>
      </dl>

      {!user.canBuy && (
        <Link href="/verify" className="btn btn-ghost btn-block mt-4">
          本人確認を進める
        </Link>
      )}
    </section>
  );
}
