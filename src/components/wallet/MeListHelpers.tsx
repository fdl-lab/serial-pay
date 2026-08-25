import Link from "next/link";
import type { ReactNode } from "react";

export const ME_PREVIEW_LIMIT = 5;

export function MoreLink({
  href,
  total,
  limit = ME_PREVIEW_LIMIT,
}: {
  href: string;
  total: number;
  limit?: number;
}) {
  if (total <= limit) return null;
  return (
    <Link
      href={href}
      className="btn btn-ghost btn-block mt-1 text-sm font-semibold"
    >
      もっと見る（全{total}件）
    </Link>
  );
}

export function MeSubpageShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="space-y-4 pb-28 sm:pb-4">
      <Link
        href="/me"
        className="inline-flex min-h-10 items-center text-sm font-bold text-ink-soft"
      >
        ← マイページ
      </Link>
      <header>
        <p className="brand-mark">シリアルPay</p>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
      </header>
      {children}
    </main>
  );
}
