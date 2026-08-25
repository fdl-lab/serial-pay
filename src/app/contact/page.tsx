import type { Metadata } from "next";
import Link from "next/link";
import { ContactForm } from "@/components/legal/ContactForm";

export const metadata: Metadata = {
  title: "お問い合わせ | シリアルPay",
  description: "シリアルPayへのお問い合わせフォームです。",
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
      </header>

      <ContactForm />
    </main>
  );
}
