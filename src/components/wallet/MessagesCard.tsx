"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/auth/fetch";

type Message = {
  id: string;
  kind: string;
  title: string;
  body: string;
  linkHref: string | null;
  linkLabel: string | null;
  createdAt: string;
  unread: boolean;
};

export function MessagesCard({
  initialMessages,
  initialUnreadCount,
}: {
  initialMessages?: Message[] | null;
  initialUnreadCount?: number;
}) {
  const [messages, setMessages] = useState<Message[] | null>(
    initialMessages ?? null,
  );
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount ?? 0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/messages");
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          setMessages([]);
          return;
        }
        throw new Error(json.error ?? "取得に失敗しました");
      }
      setMessages(json.messages ?? []);
      setUnreadCount(json.unreadCount ?? 0);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    }
  }, []);

  useEffect(() => {
    if (initialMessages) return;
    void load();
  }, [initialMessages, load]);

  async function markRead(id: string) {
    await apiFetch(`/api/messages/${id}/read`, { method: "POST" });
    setMessages((prev) =>
      prev
        ? prev.map((m) => (m.id === id ? { ...m, unread: false } : m))
        : prev,
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await apiFetch("/api/messages/read-all", { method: "POST" });
    setMessages((prev) =>
      prev ? prev.map((m) => ({ ...m, unread: false })) : prev,
    );
    setUnreadCount(0);
  }

  if (error) return <p className="banner-error">{error}</p>;

  if (!messages) {
    return (
      <section className="card-surface">
        <p className="text-sm text-ink-soft">メッセージを読み込み中…</p>
      </section>
    );
  }

  return (
    <section className="card-surface space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">メッセージ</h2>
          <p className="mt-1 text-sm text-ink-soft">
            異議の審査結果などはこちらに届きます
            {unreadCount > 0 ? ` · 未読 ${unreadCount}` : ""}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            className="btn btn-ghost !px-3 !py-2 text-xs"
            onClick={() => void markAllRead()}
          >
            すべて既読
          </button>
        )}
      </div>

      {messages.length === 0 && (
        <p className="text-sm text-ink-soft">まだメッセージはありません</p>
      )}

      <ul className="divide-y divide-ink/10">
        {messages.map((m) => (
          <li
            key={m.id}
            className={`py-3 ${m.unread ? "bg-mint/5 -mx-2 rounded-xl px-2" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold">
                  {m.unread && (
                    <span className="mr-1 inline-block h-2 w-2 rounded-full bg-coral align-middle" />
                  )}
                  {m.title}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">
                  {m.body}
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  {new Date(m.createdAt).toLocaleString("ja-JP")}
                </p>
              </div>
              {m.unread && (
                <button
                  type="button"
                  className="btn btn-ghost shrink-0 !px-2 !py-1 text-xs"
                  onClick={() => void markRead(m.id)}
                >
                  既読
                </button>
              )}
            </div>
            {m.linkHref && (
              <Link
                href={m.linkHref}
                className="mt-2 inline-block text-sm font-semibold text-mint-deep underline"
                onClick={() => {
                  if (m.unread) void markRead(m.id);
                }}
              >
                {m.linkLabel ?? "詳細を見る"}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
