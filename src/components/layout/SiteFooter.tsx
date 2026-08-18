import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-10 border-t border-ink/10 pt-5 pb-2 text-center">
      <nav aria-label="フッター">
        <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-semibold text-ink-soft">
          <li>
            <Link
              href="/guide"
              className="underline-offset-2 hover:text-mint-deep hover:underline"
            >
              ご利用ガイド
            </Link>
          </li>
        </ul>
      </nav>
      <p className="mt-3 text-xs text-ink-soft/80">© シリアルPay</p>
    </footer>
  );
}
