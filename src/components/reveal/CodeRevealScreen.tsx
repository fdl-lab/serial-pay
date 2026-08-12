"use client";

import { useEffect, useState } from "react";
import { CountdownTimer } from "./CountdownTimer";
import { RecordingWarningModal } from "./RecordingWarningModal";
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
  const [accepted, setAccepted] = useState(false);
  const [data, setData] = useState<RevealPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

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
          if (json.buyerConfirmedAt || json.status === "COMPLETED") {
            setDone(true);
          }
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
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card-surface">
      <RecordingWarningModal
        open={!accepted}
        windowMinutes={windowMinutes}
        onAccept={() => setAccepted(true)}
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
      </header>

      <div className="mb-5 grid gap-3 rounded-2xl border border-ink/10 bg-gradient-to-r from-coral/10 to-mint/10 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
            受取確認まで
          </p>
          <CountdownTimer deadlineIso={data?.confirmationDeadlineAt ?? null} />
        </div>
        <p className="text-sm text-ink-soft">
          期限内に異議がなければ自動で取引完了・ウォレットへ売上反映。使えなかった場合は録画付きで申し立ててね。
        </p>
      </div>

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

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!data || busy || done || data?.status === "DISPUTED"}
          onClick={confirm}
        >
          {done ? "受取確認済み" : "使えたので受取確認する"}
        </button>
        <a className="btn btn-ghost" href={`/transactions/${transactionId}/dispute`}>
          使えなかった（異議申し立て）
        </a>
      </div>
    </section>
  );
}
