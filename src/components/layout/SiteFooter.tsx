import Link from "next/link";

const links = [
  { href: "/guide", label: "ご利用ガイド" },
  { href: "/tokushoho", label: "特商法表記" },
  { href: "/terms", label: "利用規約" },
  { href: "/privacy", label: "プライバシーポリシー" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-ink/10 pt-5 pb-2 text-center">
      <nav aria-label="フッター">
        <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-semibold text-ink-soft">
          {links.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="underline-offset-2 hover:text-mint-deep hover:underline"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <p className="mt-3 text-xs text-ink-soft/80">
        © FDL合同会社 / シリアルPay
      </p>
    </footer>
  );
}
