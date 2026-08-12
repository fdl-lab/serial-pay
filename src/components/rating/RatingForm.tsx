"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/auth/fetch";

type Props = {
  transactionId: string;
  onDone?: () => void;
};

export function RatingForm({ transactionId, onDone }: Props) {
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
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
      className="space-y-3 rounded-2xl border border-ink/10 bg-ink/[0.03] p-4"
      onSubmit={submit}
    >
      <div>
        <p className="font-bold">評価して取引を完了する</p>
        <p className="mt-1 text-sm text-ink-soft">
          評価を送ると取引完了になり、出品者へ売上が反映されるよ
        </p>
      </div>

      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`h-10 w-10 rounded-full text-sm font-bold ${
              score >= n
                ? "bg-coral text-white"
                : "border border-ink/15 bg-white text-ink-soft"
            }`}
            onClick={() => setScore(n)}
            aria-label={`${n}点`}
          >
            {n}
          </button>
        ))}
      </div>

      <label className="field">
        <span>コメント（任意）</span>
        <textarea
          rows={3}
          maxLength={500}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="スムーズだった、コードすぐ使えた、など"
        />
      </label>

      {error && <p className="banner-error">{error}</p>}

      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "送信中…" : "評価して取引完了"}
      </button>
    </form>
  );
}
