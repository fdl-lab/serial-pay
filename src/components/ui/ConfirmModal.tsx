"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = "終了する",
  cancelLabel = "キャンセル",
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-y-auto overscroll-y-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div
        className="fixed inset-0 bg-ink/55 backdrop-blur-sm"
        aria-hidden
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div className="relative flex min-h-[100dvh] items-center justify-center px-4 py-8">
        <div className="relative w-full max-w-md rounded-2xl border border-ink/10 bg-paper p-5 shadow-xl sm:p-6">
          <h2
            id="confirm-modal-title"
            className="text-xl font-extrabold tracking-tight"
          >
            {title}
          </h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
            {body}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              className="btn btn-primary btn-block min-h-12"
              disabled={busy}
              onClick={onConfirm}
            >
              {busy ? "処理中…" : confirmLabel}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-block min-h-12"
              disabled={busy}
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
