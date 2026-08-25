"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/lib/auth/fetch";

const links = [
  { href: "/", label: "一覧" },
  { href: "/sell", label: "出品" },
  { href: "/me", label: "マイページ" },
];

export function MobileNav() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/messages/unread-count");
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setUnread(Number(json.unreadCount) || 0);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 backdrop-blur supports-[padding:max(0px)]:pb-[env(safe-area-inset-bottom)]"
      aria-label="メインメニュー"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {links.map((l) => {
          const active =
            l.href === "/"
              ? pathname === "/"
              : pathname.startsWith(l.href);
          const showBadge = l.href === "/me" && unread > 0;
          return (
            <li key={l.href} className="flex-1">
              <Link
                href={l.href}
                className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${
                  active ? "text-mint-deep" : "text-ink-soft"
                }`}
              >
                <span
                  className={`h-1 w-1 rounded-full ${active ? "bg-mint-deep" : "bg-transparent"}`}
                  aria-hidden
                />
                <span className="relative">
                  {l.label}
                  {showBadge && (
                    <span className="absolute -right-4 -top-2 min-w-4 rounded-full bg-coral px-1 text-center text-[9px] font-extrabold leading-4 text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
