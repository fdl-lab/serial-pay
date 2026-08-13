"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/auth/fetch";

type Props = {
  transactionId: string;
  onDone?: () => void;
};

export function RatingForm({ transactionId, onDone }: Props) {
  const [score, setScore] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const display = hover ?? score;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (score == null) {
      setError("★をタップして選択してください");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/transactions/${transactionId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score,
          comment: comment.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json.code === "ALREADY_RATED") {
          setDone(true);
          onDone?.();
          return;
        }
        throw new Error(json.error ?? "評価に失敗しました");
      }
      setDone(true);
      onDone?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-mint/40 bg-mint/10 p-4 text-sm">
        <p className="font-bold text-mint-deep">ご評価ありがとうございます。取引が完了しました</p>
        <p className="mt-1 text-ink-soft">出品者へ売上が反映されました</p>
      </div>
    );
  }

  return (
    <form
      className="relative z-0 space-y-4 rounded-2xl border border-ink/10 bg-ink/[0.03] p-4"
      onSubmit={submit}
    >
      <div>
        <p className="font-bold">評価して取引を完了する</p>
        <p className="mt-1 text-sm text-ink-soft">
          ★をタップして選んでから、完了ボタンを押してください
        </p>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-semibold">
          {score == null ? (
            <span className="text-coral">★を選択してください</span>
          ) : (
            <>
              選択中{" "}
              <span className="font-extrabold text-coral">★{score}</span>
            </>
          )}
        </p>
        <div
          className="flex items-center gap-0.5"
          role="radiogroup"
          aria-label="評価（星）"
          onMouseLeave={() => setHover(null)}
        >
          {[1, 2, 3, 4, 5].map((n) => {
            const on = display != null && display >= n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={score === n}
                aria-label={`${n}つ星`}
                style={{ touchAction: "manipulation" }}
                className={`flex h-10 w-10 items-center justify-center rounded-lg text-[1.65rem] leading-none transition active:scale-90 ${
                  on ? "text-coral" : "text-ink/20"
                }`}
                onMouseEnter={() => setHover(n)}
                onFocus={() => setHover(n)}
                onClick={() => {
                  setScore(n);
                  setError(null);
                }}
              >
                ★
              </button>
            );
          })}
        </div>
      </div>

      <label className="field !mb-0">
        <span>コメント（任意）</span>
        <textarea
          rows={3}
          maxLength={500}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="スムーズだった、コードすぐ使えた、など"
        />
      </label>

      {error && <p className="banner-error !mb-0">{error}</p>}

      <button
        className="btn btn-primary btn-block min-h-12 text-base"
        type="submit"
        disabled={busy || score == null}
        style={{ touchAction: "manipulation" }}
      >
        {busy
          ? "送信中…"
          : score == null
            ? "先に★を選択してください"
            : `★${score} で評価して取引完了`}
      </button>
    </form>
  );
}
