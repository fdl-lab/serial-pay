"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";

export function ListingSearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setQ(searchParams.get("q") ?? "");
  }, [searchParams]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const next = q.trim();
    startTransition(() => {
      router.push(next ? `/?q=${encodeURIComponent(next)}` : "/");
    });
  }

  function clear() {
    setQ("");
    startTransition(() => {
      router.push("/");
    });
  }

  return (
    <form onSubmit={submit} className="flex gap-2" role="search">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">フリー検索</span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="アーティスト名・タイトル・イベントで検索"
          enterKeyHint="search"
          autoComplete="off"
          className="min-h-12 w-full rounded-xl border border-ink/15 bg-white px-3.5 py-3 text-base outline-none ring-mint/40 placeholder:text-ink-soft/70 focus:ring-2"
        />
      </label>
      <button
        type="submit"
        className="btn btn-primary !min-h-12 shrink-0 !px-4"
        disabled={pending}
      >
        検索
      </button>
      {searchParams.get("q") && (
        <button
          type="button"
          className="btn btn-ghost !min-h-12 shrink-0 !px-3"
          onClick={clear}
          disabled={pending}
        >
          クリア
        </button>
      )}
    </form>
  );
}
