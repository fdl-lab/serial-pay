"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CountdownTimer } from "./CountdownTimer";
import { RecordingWarningModal } from "./RecordingWarningModal";
import { RatingForm } from "@/components/rating/RatingForm";
import { apiFetch } from "@/lib/auth/fetch";
import { formatRemainingUntil } from "@/lib/format";

type RevealPayload = {
  transactionId: string;
  itemTitle: string;
  eventName: string | null;
  status: string;
  quantity: number;
  codeRevealedAt: string | null;
  confirmationDeadlineAt: string | null;
  confirmationTimerPaused?: boolean;
  confirmationPausedRemainingSec?: number | null;
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
  windowMinutes = 60,
}: Props) {
  const router = useRouter();
  /** null = ゲート確認中 / true = コード取得OK / false = 注釈待ち（未開示） */
  const [accepted, setAccepted] = useState<boolean | null>(null);
  const [deferred, setDeferred] = useState(false);
  const [data, setData] = useState<RevealPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [gateMinutes, setGateMinutes] = useState(windowMinutes);
  const [revealDeadlineAt, setRevealDeadlineAt] = useState<string | null>(null);
  const [revealHoldHours, setRevealHoldHours] = useState(72);
  const [remainingLabel, setRemainingLabel] = useState<string | null>(null);

  // 先に状態だけ見る（ここではタイマーを開始しない）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(
          `/api/transactions/${transactionId}/reveal-gate`,
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "取得に失敗しました");
        if (cancelled) return;
        if (typeof json.confirmationWindowMinutes === "number") {
          setGateMinutes(json.confirmationWindowMinutes);
        }
        if (typeof json.revealHoldHours === "number") {
          setRevealHoldHours(json.revealHoldHours);
        }
        setRevealDeadlineAt(json.revealDeadlineAt ?? null);
        if (json.awaitingReveal) {
          // 未開示 → 注釈。タイマーはまだ開始しない
          setAccepted(false);
        } else {
          // すでに開示済み → 注釈スキップしてコード取得
          setAccepted(true);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "エラーが発生しました");
          setAccepted(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transactionId]);

  // 開示前: 残り時間を更新
  useEffect(() => {
    if (!revealDeadlineAt || accepted !== false) {
      setRemainingLabel(null);
      return;
    }
    const tick = () => {
      setRemainingLabel(formatRemainingUntil(revealDeadlineAt));
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [revealDeadlineAt, accepted]);

  // 同意後（または再訪で開示済み）だけコード取得。初回のみここでタイマー開始
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
          ? {
              ...prev,
              buyerConfirmedAt: prev.buyerConfirmedAt ?? new Date().toISOString(),
            }
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

  const showModal = accepted === false && !deferred;

  return (
    <section className="card-surface">
      <RecordingWarningModal
        open={showModal}
        windowMinutes={gateMinutes}
        revealHoldHours={revealHoldHours}
        remainingLabel={remainingLabel}
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
        {accepted !== true && !data && (
          <p className="mt-1 text-ink-soft">
            準備ができたら画面録画を開始し、コードを表示してください。保留もできます。
          </p>
        )}
      </header>

      {accepted && data?.status !== "COMPLETED" && (
        <div className="mb-5 grid gap-3 rounded-2xl border border-ink/10 bg-gradient-to-r from-coral/10 to-mint/10 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
              {data?.status === "DISPUTED" || data?.confirmationTimerPaused
                ? "確認タイマー"
                : "評価完了まで"}
            </p>
            {data?.status === "DISPUTED" || data?.confirmationTimerPaused ? (
              <>
                <p className="font-mono text-2xl font-semibold text-mint-deep">
                  停止中
                </p>
                <p className="mt-1 text-[11px] font-semibold text-ink-soft">
                  {data?.status === "DISPUTED"
                    ? "異議審査中のためタイマー停止"
                    : "異議申し立て準備中のためタイマー停止"}
                  {typeof data.confirmationPausedRemainingSec === "number"
                    ? `（残り約 ${Math.ceil(data.confirmationPausedRemainingSec / 60)} 分）`
                    : ""}
                </p>
              </>
            ) : (
              <>
                <CountdownTimer
                  deadlineIso={data?.confirmationDeadlineAt ?? null}
                />
                <p className="mt-1 text-[11px] font-semibold text-ink-soft">
                  コードを表示したときから計測
                </p>
              </>
            )}
          </div>
          <p className="text-sm text-ink-soft">
            {data?.status === "DISPUTED" || data?.confirmationTimerPaused
              ? data?.status === "DISPUTED"
                ? "異議の審査が終わるまで、自動完了は進みません。結果はメッセージでお知らせします。"
                : "異議申し立ての準備中はタイマーを止めています。申請を送るか、受取確認に戻ることもできます。"
              : "受取確認のあと、出品者を評価すると取引完了・売上反映になります。期限を過ぎると、評価なしでも自動完了します。"}
          </p>
        </div>
      )}

      {error && <p className="banner-error">{error}</p>}
      {accepted === null && !error && (
        <p className="text-ink-soft">準備中…</p>
      )}
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
                {copiedId === c.id ? "コピーしました" : "コピー"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {accepted &&
        data &&
        data.status !== "COMPLETED" &&
        data.status !== "DISPUTED" &&
        !confirmed && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn btn-primary btn-block min-h-12 sm:flex-1"
              disabled={!data || busy}
              onClick={confirm}
            >
              {busy ? "確認中…" : "使えたので受取確認する"}
            </button>
            {canDispute && (
              <a
                className="btn btn-ghost btn-block min-h-12 sm:flex-1"
                href={`/transactions/${transactionId}/dispute`}
              >
                使えなかった（異議申し立て）
              </a>
            )}
          </div>
        )}

      {accepted && data && confirmed && !completed && data.status !== "DISPUTED" && (
        <div className="mt-5 space-y-3">
          <p className="rounded-xl border border-mint/30 bg-mint/10 px-3 py-2 text-sm font-semibold text-mint-deep">
            受取確認が完了しました。下の星を選んで「評価して取引完了」を押してください
          </p>
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
        <p className="banner-ok mt-5">
          取引が完了しました。ご評価ありがとうございます。出品者へ売上が反映されました。
        </p>
      )}

      {accepted === false && (
        <div className="space-y-3 text-center text-sm text-ink-soft">
          {remainingLabel && (
            <p className="rounded-xl bg-coral/10 px-3 py-3 font-semibold text-coral">
              <span className="block text-xs font-bold uppercase tracking-wider text-ink-soft">
                開示期限まで
              </span>
              <span className="mt-1 block font-mono text-2xl font-extrabold">
                {remainingLabel}
              </span>
              <span className="mt-1 block text-xs font-normal text-ink-soft">
                購入から{revealHoldHours}
                時間以内に開示してください（過ぎると返金なし・評価★1）
              </span>
            </p>
          )}
          {revealDeadlineAt && (
            <p className="text-xs text-ink-soft">
              期限{" "}
              {new Date(revealDeadlineAt).toLocaleString("ja-JP", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              まで · キャンセル不可
            </p>
          )}
          <p>
            あとで見る場合は{" "}
            <Link href="/me" className="font-semibold text-mint-deep underline">
              マイページ
            </Link>{" "}
            の「開示前のシリアル」から開けるよ
          </p>
        </div>
      )}
    </section>
  );
}
