"use client";

import { useState, type FormEvent } from "react";

export function ContactForm() {
  const [subject, setSubject] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, name, email, body, website }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "送信に失敗しました");
      setDone(true);
      setSubject("");
      setName("");
      setEmail("");
      setBody("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className="card-surface space-y-3">
        <p className="font-bold text-mint-deep">送信しました</p>
        <p className="text-sm text-ink-soft leading-relaxed">
          お問い合わせありがとうございます。内容を確認のうえ、返信先メールアドレスへご連絡します。
        </p>
        <button
          type="button"
          className="btn btn-ghost btn-block"
          onClick={() => setDone(false)}
        >
          別の内容を送る
        </button>
      </section>
    );
  }

  return (
    <form className="card-surface space-y-3" onSubmit={(e) => void submit(e)}>
      <label className="field">
        <span>件名</span>
        <input
          required
          maxLength={120}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="お問い合わせの件名"
        />
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
          placeholder="ご質問・ご依頼内容をご記入ください"
        />
      </label>

      {/* honeypot */}
      <label className="hidden" aria-hidden>
        <span>website</span>
        <input
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </label>

      {error && <p className="banner-error">{error}</p>}

      <button
        type="submit"
        className="btn btn-primary btn-block"
        disabled={busy}
      >
        {busy ? "送信中…" : "送信する"}
      </button>
    </form>
  );
}
