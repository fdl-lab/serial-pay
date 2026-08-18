"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";

const CONTACT_EMAIL = "info@f-d-l.jp";

const SUBJECTS = [
  "運営責任者名の開示請求",
  "電話番号の開示請求",
  "その他のお問い合わせ",
] as const;

export function ContactForm() {
  const [subject, setSubject] = useState<(typeof SUBJECTS)[number]>(
    SUBJECTS[0],
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");

  const mailtoHref = useMemo(() => {
    const lines = [
      `お名前: ${name || "（未入力）"}`,
      `返信先メール: ${email || "（未入力）"}`,
      "",
      body || "（本文未入力）",
    ];
    const params = new URLSearchParams({
      subject,
      body: lines.join("\n"),
    });
    return `mailto:${CONTACT_EMAIL}?${params.toString()}`;
  }, [subject, name, email, body]);

  function submit(e: FormEvent) {
    e.preventDefault();
    window.location.href = mailtoHref;
  }

  return (
    <form className="card-surface space-y-3" onSubmit={submit}>
      <label className="field">
        <span>お問い合わせ種別</span>
        <select
          value={subject}
          onChange={(e) =>
            setSubject(e.target.value as (typeof SUBJECTS)[number])
          }
        >
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>お名前</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="山田 太郎"
        />
      </label>

      <label className="field">
        <span>返信先メールアドレス</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </label>

      <label className="field">
        <span>内容</span>
        <textarea
          required
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="ご請求・ご質問内容をご記入ください"
        />
      </label>

      <p className="text-xs text-ink-soft">
        送信するとメールアプリが開き、宛先
        <code className="mx-1 rounded bg-ink/5 px-1 font-mono">
          {CONTACT_EMAIL}
        </code>
        へ送信できます。
      </p>

      <button type="submit" className="btn btn-primary btn-block">
        メールで送信する
      </button>

      <p className="text-center text-sm">
        <Link href="/tokushoho" className="font-semibold text-mint-deep underline">
          特商法表記へ戻る
        </Link>
      </p>
    </form>
  );
}
