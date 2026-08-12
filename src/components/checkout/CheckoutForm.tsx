"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions } from "@stripe/stripe-js";
import { formatYen } from "@/lib/format";
import { apiFetch } from "@/lib/auth/fetch";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
);

type SessionPayload = {
  transactionId: string;
  status: string;
  needsPayment: boolean;
  clientSecret?: string;
  amountChargedYen: number;
  walletPaidYen: number;
  stripePaidYen: number;
  itemTitle: string;
  artistName?: string | null;
};

function PaymentForm({
  transactionId,
  stripePaidYen,
  walletPaidYen,
  amountChargedYen,
}: {
  transactionId: string;
  stripePaidYen: number;
  walletPaidYen: number;
  amountChargedYen: number;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setBusy(true);
    setError(null);

    const returnUrl = `${window.location.origin}/transactions/${transactionId}`;
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
      },
    });

    if (confirmError) {
      setError(confirmError.message ?? "決済に失敗しました");
      setBusy(false);
      return;
    }

    // redirect しないケース（一部 payment method）
    router.push(`/transactions/${transactionId}`);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <dl className="space-y-1 rounded-xl bg-ink/5 px-3 py-3 text-sm">
        <div className="flex justify-between">
          <dt>合計</dt>
          <dd className="font-mono font-semibold">{formatYen(amountChargedYen)}</dd>
        </div>
        {walletPaidYen > 0 && (
          <div className="flex justify-between text-ink-soft">
            <dt>残高利用</dt>
            <dd className="font-mono">-{formatYen(walletPaidYen)}</dd>
          </div>
        )}
        <div className="flex justify-between font-semibold">
          <dt>カード支払</dt>
          <dd className="font-mono">{formatYen(stripePaidYen)}</dd>
        </div>
      </dl>

      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />

      {error && <p className="banner-error !mb-0">{error}</p>}

      <button
        type="submit"
        className="btn btn-primary btn-block min-h-12"
        disabled={!stripe || !elements || busy}
      >
        {busy ? "処理中…" : `${formatYen(stripePaidYen)} を支払う`}
      </button>
    </form>
  );
}

export function CheckoutClient({ transactionId }: { transactionId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/checkout/${transactionId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "決済情報の取得に失敗しました");
        if (cancelled) return;

        if (!json.needsPayment) {
          router.replace(`/transactions/${transactionId}`);
          return;
        }
        setSession(json);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "エラー");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transactionId, router]);

  const options: StripeElementsOptions | null = useMemo(() => {
    if (!session?.clientSecret) return null;
    return {
      clientSecret: session.clientSecret,
      appearance: {
        theme: "stripe",
        variables: {
          colorPrimary: "#12151c",
          borderRadius: "12px",
        },
      },
    };
  }, [session?.clientSecret]);

  if (loading) {
    return <p className="text-ink-soft">決済準備中…</p>;
  }

  if (error) {
    return <p className="banner-error">{error}</p>;
  }

  if (!session || !options) {
    return <p className="text-ink-soft">決済情報が見つからないよ</p>;
  }

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return (
      <p className="banner-error">
        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY が未設定です
      </p>
    );
  }

  return (
    <div className="card-surface space-y-4">
      <header>
        <p className="brand-mark">シリアルPay</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">お支払い</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {session.artistName ? `${session.artistName} · ` : ""}
          {session.itemTitle}
        </p>
      </header>

      <Elements stripe={stripePromise} options={options}>
        <PaymentForm
          transactionId={session.transactionId}
          stripePaidYen={session.stripePaidYen}
          walletPaidYen={session.walletPaidYen}
          amountChargedYen={session.amountChargedYen}
        />
      </Elements>
    </div>
  );
}
