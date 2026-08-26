import Link from "next/link";

const secondaryLinks = [
  { href: "/tokushoho", label: "特商法表記" },
  { href: "/terms", label: "利用規約" },
  { href: "/privacy", label: "プライバシーポリシー" },
  { href: "/contact", label: "お問い合わせ" },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-ink/10 pt-5 pb-2 text-center">
      <nav aria-label="フッター" className="space-y-3">
        <div>
          <Link
            href="/guide"
            className="btn btn-primary inline-flex !min-h-10 !px-5 !py-2 text-xs"
          >
            ご利用ガイド
          </Link>
        </div>
        <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[11px] font-medium text-ink-soft">
          {secondaryLinks.map((l) => (
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
      <p className="mt-3 text-[10px] leading-relaxed text-ink-soft/80">
        イベント情報は暗号化保管・出品数の非集計。詳しくは
        <Link
          href="/guide#event-privacy"
          className="underline-offset-2 hover:text-mint-deep hover:underline"
        >
          ご利用ガイド
        </Link>
      </p>
      <p className="mt-1.5 text-[10px] text-ink-soft/80">© シリアルPay</p>
    </footer>
  );
}
