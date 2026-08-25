"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/auth/fetch";

type Author = {
  id: string;
  publicId: string | null;
  displayName: string | null;
  avatarUrl: string | null;
};

type Comment = {
  id: string;
  body: string | null;
  deleted: boolean;
  createdAt: string;
  author: Author;
  replies?: Comment[];
  parentId?: string | null;
};

type Props = {
  itemId: string;
  sellerId: string;
  currentUserId?: string | null;
  canComment: boolean;
  commentsDisabledReason?: string | null;
};

export function ListingComments({
  itemId,
  sellerId,
  currentUserId = null,
  canComment,
  commentsDisabledReason = null,
}: Props) {
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/listings/${itemId}/comments`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "取得に失敗しました");
      setComments(json.comments ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  }, [itemId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canComment) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/listings/${itemId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, parentId: replyTo }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "投稿に失敗しました");
      setBody("");
      setReplyTo(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("このコメントを削除しますか？")) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/comments/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "削除に失敗しました");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  function renderRow(c: Comment, isReply = false) {
    const name = c.author.displayName?.trim() || "ユーザー";
    const canDelete =
      currentUserId &&
      (currentUserId === c.author.id || currentUserId === sellerId);

    return (
      <li
        key={c.id}
        className={`${isReply ? "ml-4 border-l border-ink/10 pl-3" : ""} py-3`}
      >
        <p className="text-xs font-bold text-ink-soft">
          {name}
          {c.author.id === sellerId ? " · 出品者" : ""}
          {" · "}
          {new Date(c.createdAt).toLocaleString("ja-JP")}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-sm">
          {c.deleted ? (
            <span className="text-ink-soft">（削除されたコメント）</span>
          ) : (
            c.body
          )}
        </p>
        {!c.deleted && (
          <div className="mt-2 flex flex-wrap gap-2">
            {canComment && !isReply && (
              <button
                type="button"
                className="text-xs font-semibold text-mint-deep underline"
                onClick={() => setReplyTo(c.id)}
              >
                返信
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                className="text-xs font-semibold text-coral underline"
                disabled={busy}
                onClick={() => void remove(c.id)}
              >
                削除
              </button>
            )}
          </div>
        )}
        {c.replies && c.replies.length > 0 && (
          <ul className="mt-1">{c.replies.map((r) => renderRow(r, true))}</ul>
        )}
      </li>
    );
  }

  return (
    <section id="comments" className="card-surface space-y-3 scroll-mt-24">
      <div>
        <h2 className="text-lg font-bold">コメント</h2>
        <p className="mt-1 text-sm text-ink-soft">
          公開の質問・回答です。個人情報のやり取りはお控えください。
        </p>
      </div>

      {error && <p className="banner-error">{error}</p>}

      {!comments && (
        <p className="text-sm text-ink-soft">コメントを読み込み中…</p>
      )}

      {comments && comments.length === 0 && (
        <p className="text-sm text-ink-soft">まだコメントはありません</p>
      )}

      {comments && comments.length > 0 && (
        <ul className="divide-y divide-ink/10">
          {comments.map((c) => renderRow(c))}
        </ul>
      )}

      {canComment ? (
        <form className="space-y-2 border-t border-ink/10 pt-3" onSubmit={submit}>
          {replyTo && (
            <p className="text-xs text-ink-soft">
              返信中{" "}
              <button
                type="button"
                className="font-semibold underline"
                onClick={() => setReplyTo(null)}
              >
                キャンセル
              </button>
            </p>
          )}
          <label className="field">
            <span>{replyTo ? "返信内容" : "コメント"}</span>
            <textarea
              rows={3}
              maxLength={500}
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="出品者への質問など"
            />
          </label>
          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={busy || !body.trim()}
          >
            {busy ? "送信中…" : replyTo ? "返信する" : "コメントする"}
          </button>
        </form>
      ) : (
        <div className="rounded-xl bg-ink/5 px-3 py-3 text-sm text-ink-soft">
          {commentsDisabledReason ?? (
            <>
              コメントには{" "}
              <Link href="/auth" className="font-semibold text-mint-deep underline">
                ログイン
              </Link>
              と本人確認が必要です。
            </>
          )}
        </div>
      )}
    </section>
  );
}
