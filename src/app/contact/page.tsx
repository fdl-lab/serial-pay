import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/legal/ContactForm";

export const metadata: Metadata = {
  title: "お問い合わせ | シリアルPay",
  description: "シリアルPayへのお問い合わせ・開示請求フォームです。",
};

export default function ContactPage() {
  return (
    <main className="space-y-6 pb-8">
      <nav className="nav">
        <Link href="/">← トップ</Link>
      </nav>

      <header className="card-surface space-y-2">
        <p className="brand-mark">シリアルPay</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          お問い合わせ
        </h1>
        <p className="text-sm leading-relaxed text-ink-soft">
          運営責任者名や電話番号の開示請求、その他のご質問はこちらからお願いします。
          内容確認のうえ、遅滞なく対応いたします。
        </p>
      </header>

      <ContactForm />
    </main>
  );
}
