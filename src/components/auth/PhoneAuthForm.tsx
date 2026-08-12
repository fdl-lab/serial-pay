"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { toE164Japan } from "@/lib/phone";
import { apiFetch } from "@/lib/auth/fetch";

type Step = "phone" | "otp";

export function PhoneAuthForm({ redirectTo = "/verify" }: { redirectTo?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [e164, setE164] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const supabaseReady = isSupabaseConfigured();

  async function sendOtp(e: FormEvent) {
    e.preventDefault();
    if (!supabaseReady) {
      setError("Supabase が未設定です。.env.local を確認してね");
      return;
    }
    const normalized = toE164Japan(phone);
    if (!normalized) {
      setError("電話番号の形式が正しくないよ（例: 09012345678）");
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: sbError } = await supabase.auth.signInWithOtp({
        phone: normalized,
      });
      if (sbError) throw new Error(sbError.message);
      setE164(normalized);
      setStep("otp");
      setMessage("SMSに届いた6桁コードを入力してね");
    } catch (err) {
      setError(err instanceof Error ? err.message : "SMS送信に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(e: FormEvent) {
    e.preventDefault();
    if (!e164 || !supabaseReady) return;

    setBusy(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: sbError } = await supabase.auth.verifyOtp({
        phone: e164,
        token: otp.trim(),
        type: "sms",
      });
      if (sbError) throw new Error(sbError.message);

      const syncRes = await apiFetch("/api/auth/sync", { method: "POST" });
      const syncJson = await syncRes.json();
      if (!syncRes.ok) {
        throw new Error(syncJson.error ?? "ユーザー同期に失敗しました");
      }

      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "認証に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  if (!supabaseReady) {
    return (
      <div className="card-surface">
        <p className="banner-error">
          Supabase Auth が未設定です。開発中は <code>DEV_AUTH_BYPASS</code> で動かせるよ。
        </p>
        <p className="text-sm text-ink-soft">
          本番用には <code>NEXT_PUBLIC_SUPABASE_URL</code> と{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> を設定してね。
        </p>
      </div>
    );
  }

  return (
    <div className="card-surface">
      <header className="mb-6">
        <p className="brand-mark">シリアルPay</p>
        <h1 className="text-3xl font-extrabold tracking-tight">SMSログイン</h1>
        <p className="mt-2 text-ink-soft">
          携帯番号に届くコードでログインするよ。購入・出品には本人確認も必要。
        </p>
      </header>

      {step === "phone" && (
        <form onSubmit={sendOtp} className="space-y-4">
          <label className="field !mb-0">
            <span>携帯電話番号</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="09012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="min-h-12"
            />
          </label>
          <button type="submit" className="btn btn-primary btn-block min-h-12" disabled={busy}>
            {busy ? "送信中…" : "SMSコードを送る"}
          </button>
        </form>
      )}

      {step === "otp" && (
        <form onSubmit={verifyOtp} className="space-y-4">
          <p className="text-sm text-ink-soft">
            <span className="font-mono">{e164}</span> にコードを送ったよ
          </p>
          <label className="field !mb-0">
            <span>認証コード（6桁）</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
              maxLength={6}
              className="min-h-12 font-mono text-lg tracking-widest"
            />
          </label>
          <button type="submit" className="btn btn-primary btn-block min-h-12" disabled={busy}>
            {busy ? "確認中…" : "ログインする"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            onClick={() => {
              setStep("phone");
              setOtp("");
              setMessage(null);
            }}
          >
            番号を変更
          </button>
        </form>
      )}

      {message && <p className="banner-ok mt-4">{message}</p>}
      {error && <p className="banner-error mt-4">{error}</p>}
    </div>
  );
}
