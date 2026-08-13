"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/auth/fetch";

type Props = {
  transactionId: string;
  onDone?: () => void;
};

export function RatingForm({ transactionId, onDone }: Props) {
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (score == null) {
      setError("★をタップして点数を選んでね");
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
        <p className="font-bold text-mint-deep">評価ありがとう！取引完了だよ</p>
        <p className="mt-1 text-ink-soft">出品者へ売上が反映されたよ</p>
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
          下の数字をタップして点数を選んでから、完了ボタンを押してね
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">
          {score == null ? (
            <span className="text-coral">← ここをタップして選ぶ</span>
          ) : (
            <>
              選択中{" "}
              <span className="font-mono text-base font-extrabold text-coral">
                ★{score}
              </span>
            </>
          )}
        </p>
        <div
          className="grid grid-cols-5 gap-2"
          role="radiogroup"
          aria-label="評価スコア"
        >
          {[1, 2, 3, 4, 5].map((n) => {
            const selected = score === n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`${n}点`}
                style={{ touchAction: "manipulation" }}
                className={`flex h-14 w-full items-center justify-center rounded-2xl text-lg font-extrabold transition active:scale-95 ${
                  selected
                    ? "bg-coral text-white shadow-md shadow-coral/30 ring-2 ring-coral ring-offset-2"
                    : "border-2 border-dashed border-ink/25 bg-white text-ink-soft"
                }`}
                onClick={() => {
                  setScore(n);
                  setError(null);
                }}
              >
                {n}
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
            ? "先に点数を選んでね"
            : `★${score} で評価して取引完了`}
      </button>
    </form>
  );
}
