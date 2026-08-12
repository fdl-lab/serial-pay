"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "一覧" },
  { href: "/sell", label: "出品" },
  { href: "/me", label: "マイページ" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-white/95 backdrop-blur supports-[padding:max(0px)]:pb-[env(safe-area-inset-bottom)] sm:hidden"
      aria-label="メインメニュー"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {links.map((l) => {
          const active =
            l.href === "/"
              ? pathname === "/"
              : pathname.startsWith(l.href);
          return (
            <li key={l.href} className="flex-1">
              <Link
                href={l.href}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-bold ${
                  active ? "text-mint-deep" : "text-ink-soft"
                }`}
              >
                <span
                  className={`h-1 w-1 rounded-full ${active ? "bg-mint-deep" : "bg-transparent"}`}
                  aria-hidden
                />
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
