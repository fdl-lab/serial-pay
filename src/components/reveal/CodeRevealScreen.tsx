"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CountdownTimer } from "./CountdownTimer";
import { RecordingWarningModal } from "./RecordingWarningModal";
import { RatingForm } from "@/components/rating/RatingForm";
import { apiFetch } from "@/lib/auth/fetch";

type RevealPayload = {
  transactionId: string;
  itemTitle: string;
  eventName: string | null;
  status: string;
  quantity: number;
  codeRevealedAt: string | null;
  confirmationDeadlineAt: string | null;
  buyerConfirmedAt: string | null;
  hasRated: boolean;
  codes: { id: string; plaintext: string; status: string }[];
};

type Props = {
  transactionId: string;
  windowMinutes?: number;
};

export function CodeRevealScreen({
  transactionId,
  windowMinutes = 30,
}: Props) {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);
  const [deferred, setDeferred] = useState(false);
  const [data, setData] = useState<RevealPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!accepted) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/transactions/${transactionId}/reveal`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "取得に失敗しました");
        if (!cancelled) {
          setData(json);
          if (json.buyerConfirmedAt) setConfirmed(true);
          if (json.status === "COMPLETED" || json.hasRated) setCompleted(true);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "エラーが発生しました");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accepted, transactionId]);

  async function copyCode(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1600);
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/transactions/${transactionId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "受取確認に失敗しました");
      setConfirmed(true);
      setData((prev) =>
        prev
          ? { ...prev, buyerConfirmedAt: prev.buyerConfirmedAt ?? new Date().toISOString() }
          : prev,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  function deferReveal() {
    setDeferred(true);
    router.push("/me");
  }

  const canDispute =
    !confirmed &&
    data &&
    data.status !== "COMPLETED" &&
    data.status !== "DISPUTED";

  return (
    <section className="card-surface">
      <RecordingWarningModal
        open={!accepted && !deferred}
        windowMinutes={windowMinutes}
        onAccept={() => setAccepted(true)}
        onDefer={deferReveal}
      />

      <header className="mb-5">
        <p className="brand-mark">シリアルPay</p>
        <h1 className="text-3xl font-extrabold tracking-tight">コード即時開示</h1>
        {data && (
          <p className="mt-1 text-ink-soft">
            {data.itemTitle}
            {data.eventName ? ` · ${data.eventName}` : ""}
          </p>
        )}
        {!accepted && !data && (
          <p className="mt-1 text-ink-soft">
            準備ができたら画録を開始してコードを表示してね。保留もできるよ。
          </p>
        )}
      </header>

      {accepted && data?.status !== "COMPLETED" && (
        <div className="mb-5 grid gap-3 rounded-2xl border border-ink/10 bg-gradient-to-r from-coral/10 to-mint/10 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
              評価完了まで
            </p>
            <CountdownTimer deadlineIso={data?.confirmationDeadlineAt ?? null} />
          </div>
          <p className="text-sm text-ink-soft">
            受取確認のあと、出品者を評価すると取引完了・売上反映になるよ。期限を過ぎると評価なしでも自動完了するよ。
          </p>
        </div>
      )}

      {error && <p className="banner-error">{error}</p>}
      {accepted && !data && !error && (
        <p className="text-ink-soft">コードを復号中…</p>
      )}

      {data && (
        <ul className="mb-5 grid gap-2">
          {data.codes.map((c, i) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-ink/10 bg-white px-3 py-3"
            >
              <div className="min-w-0">
                <span className="mr-2 text-xs font-bold text-ink-soft">#{i + 1}</span>
                <code className="break-all font-mono text-sm sm:text-base">
                  {c.plaintext}
                </code>
              </div>
              <button
                type="button"
                className="btn btn-ghost shrink-0 !px-3 !py-2 text-xs"
                onClick={() => copyCode(c.id, c.plaintext)}
              >
                {copiedId === c.id ? "コピーした！" : "コピー"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {accepted && data && data.status !== "COMPLETED" && data.status !== "DISPUTED" && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!data || busy || confirmed}
            onClick={confirm}
          >
            {confirmed ? "受取確認済み → 評価へ" : "使えたので受取確認する"}
          </button>
          {canDispute && (
            <a
              className="btn btn-ghost"
              href={`/transactions/${transactionId}/dispute`}
            >
              使えなかった（異議申し立て）
            </a>
          )}
        </div>
      )}

      {accepted && data && confirmed && !completed && data.status !== "DISPUTED" && (
        <div className="mt-5">
          <RatingForm
            transactionId={transactionId}
            onDone={() => {
              setCompleted(true);
              setData((prev) =>
                prev ? { ...prev, status: "COMPLETED", hasRated: true } : prev,
              );
            }}
          />
        </div>
      )}

      {completed && (
        <p className="banner-ok mt-5">取引完了！評価ありがとう。出品者へ売上が反映されたよ。</p>
      )}

      {!accepted && (
        <p className="text-center text-sm text-ink-soft">
          あとで見る場合は{" "}
          <Link href="/me" className="font-semibold text-mint-deep underline">
            マイページ
          </Link>{" "}
          の「開示前のシリアル」から開けるよ
        </p>
      )}
    </section>
  );
}
