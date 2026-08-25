"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/auth/fetch";
import { ME_PREVIEW_LIMIT, MoreLink } from "@/components/wallet/MeListHelpers";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

/** マイページのお知らせプレビュー件数 */
export const MESSAGES_PREVIEW_LIMIT = 3;

type Message = {
  id: string;
  kind: string;
  title: string;
  body: string;
  linkHref: string | null;
  linkLabel: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  createdAt: string;
  unread: boolean;
};

function transactionIdFromMessage(m: Message): string | null {
  if (m.relatedEntityType === "Transaction" && m.relatedEntityId) {
    return m.relatedEntityId;
  }
  const href = m.linkHref ?? "";
  const match = href.match(/^\/transactions\/([^/]+)/);
  return match?.[1] ?? null;
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessagesCard({
  initialMessages,
  initialUnreadCount,
  previewLimit,
  moreHref = "/me/messages",
}: {
  initialMessages?: Message[] | null;
  initialUnreadCount?: number;
  previewLimit?: number;
  moreHref?: string;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[] | null>(
    initialMessages ?? null,
  );
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [abandonBusyId, setAbandonBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Message | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

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
    void load();
  }, [load]);

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

  function toggleExpanded(m: Message) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(m.id)) next.delete(m.id);
      else next.add(m.id);
      return next;
    });
    if (m.unread) void markRead(m.id);
  }

  async function runAbandon(m: Message) {
    const transactionId = transactionIdFromMessage(m);
    if (!transactionId) {
      setActionError("取引が見つかりませんでした");
      setConfirmTarget(null);
      return;
    }
    setAbandonBusyId(m.id);
    setActionError(null);
    try {
      const res = await apiFetch(
        `/api/transactions/${transactionId}/dispute/abandon`,
        { method: "POST" },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? "終了に失敗しました");
      }
      setMessages((prev) =>
        prev
          ? prev.map((row) =>
              row.id === m.id ||
              (row.kind === "DISPUTE_REJECTED" &&
                transactionIdFromMessage(row) === transactionId)
                ? {
                    ...row,
                    kind: "DISPUTE_REJECTED_HANDLED",
                    unread: false,
                    linkHref: `/transactions/${transactionId}`,
                    linkLabel: "取引を見る",
                  }
                : row,
            )
          : prev,
      );
      setUnreadCount((c) => (m.unread ? Math.max(0, c - 1) : c));
      setConfirmTarget(null);
      setAbandonBusyId(null);
      router.refresh();
      const redirectTo =
        typeof json.redirectTo === "string"
          ? json.redirectTo
          : `/transactions/${transactionId}`;
      router.push(redirectTo);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "エラーが発生しました");
      setAbandonBusyId(null);
      setConfirmTarget(null);
    }
  }

  if (error) return <p className="banner-error">{error}</p>;

  if (!messages) {
    return (
      <section className="card-surface">
        <p className="text-sm text-ink-soft">メッセージを読み込み中…</p>
      </section>
    );
  }

  const limit =
    typeof previewLimit === "number" ? previewLimit : undefined;
  const visible =
    typeof limit === "number" ? messages.slice(0, limit) : messages;

  return (
    <section className="card-surface space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="me-section-title">事務局・お知らせ</h2>
          <p className="me-section-desc">
            異議の審査結果など
            {unreadCount > 0 ? ` · 未読 ${unreadCount}` : ""}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            className="btn btn-ghost shrink-0 !px-2.5 !py-1.5 text-xs"
            onClick={() => void markAllRead()}
          >
            すべて既読
          </button>
        )}
      </div>

      {messages.length === 0 && (
        <p className="text-sm text-ink-soft">まだメッセージはありません</p>
      )}

      {actionError && <p className="banner-error">{actionError}</p>}

      <ul className="divide-y divide-ink/10">
        {visible.map((m) => {
          const handled = m.kind === "DISPUTE_REJECTED_HANDLED";
          const showAbandon =
            m.kind === "DISPUTE_REJECTED" && Boolean(transactionIdFromMessage(m));
          const expanded = expandedIds.has(m.id);
          const bodyPreview = m.body.replace(/\s+/g, " ").trim();

          return (
            <li
              key={m.id}
              className={`py-2 ${m.unread ? "bg-mint/5 -mx-2 rounded-lg px-2" : ""}`}
            >
              <button
                type="button"
                className="flex w-full items-start gap-2 text-left"
                onClick={() => toggleExpanded(m)}
                aria-expanded={expanded}
              >
                <span className="mt-1.5 w-2 shrink-0">
                  {m.unread ? (
                    <span className="block h-2 w-2 rounded-full bg-coral" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="me-item-title">{m.title}</span>
                    {handled && (
                      <span className="rounded bg-ink/10 px-1 py-px text-[10px] font-medium text-ink-soft">
                        対応済み
                      </span>
                    )}
                    <span className="me-item-meta">
                      {formatShortDate(m.createdAt)}
                    </span>
                  </span>
                  {!expanded && (
                    <span className="me-item-body mt-0.5 block truncate">
                      {bodyPreview}
                    </span>
                  )}
                </span>
                <span className="mt-0.5 shrink-0 text-[11px] font-semibold text-mint-deep">
                  {expanded ? "閉じる" : "開く"}
                </span>
              </button>

              {expanded && (
                <div className="mt-2 space-y-2 pl-4">
                  <p className="me-item-body whitespace-pre-line">{m.body}</p>
                  {(m.linkHref || showAbandon) && (
                    <div className="flex flex-wrap gap-2">
                      {m.linkHref && (
                        <Link
                          href={m.linkHref}
                          className="btn btn-ghost !px-2.5 !py-1.5 text-xs"
                          onClick={() => {
                            if (m.unread) void markRead(m.id);
                          }}
                        >
                          {m.linkLabel ?? "詳細を見る"}
                        </Link>
                      )}
                      {showAbandon && (
                        <button
                          type="button"
                          className="btn btn-primary !px-2.5 !py-1.5 text-xs"
                          disabled={abandonBusyId === m.id}
                          onClick={() => setConfirmTarget(m)}
                        >
                          {abandonBusyId === m.id
                            ? "処理中…"
                            : "申請せずに終了する"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {typeof limit === "number" && (
        <MoreLink
          href={moreHref}
          total={messages.length}
          limit={limit || ME_PREVIEW_LIMIT}
        />
      )}

      <ConfirmModal
        open={Boolean(confirmTarget)}
        title="本当に終了しますか？"
        body={
          "再申請は行わず、開示前の状態に戻ります。\nもう一度開示すると確認タイマー（60分）が新たに始まります。\n開示期限は終了した時点から72時間になります。"
        }
        confirmLabel="終了する"
        cancelLabel="キャンセル"
        busy={Boolean(confirmTarget && abandonBusyId === confirmTarget.id)}
        onCancel={() => {
          if (!abandonBusyId) setConfirmTarget(null);
        }}
        onConfirm={() => {
          if (confirmTarget) void runAbandon(confirmTarget);
        }}
      />
    </section>
  );
}
