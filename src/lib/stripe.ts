import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }
    stripeClient = new Stripe(key, {
      // インストールした stripe パッケージのデフォルト API バージョンに合わせる
      apiVersion: "2024-11-20.acacia" as Stripe.LatestApiVersion,
      typescript: true,
    });
  }
  return stripeClient;
}

export function platformFeePercent(): number {
  const raw = Number(process.env.STRIPE_PLATFORM_FEE_PERCENT ?? "10");
  if (!Number.isFinite(raw) || raw < 0 || raw > 100) return 10;
  return raw;
}

export function confirmationWindowMinutes(): number {
  const raw = Number(process.env.CONFIRMATION_WINDOW_MINUTES ?? "30");
  if (!Number.isFinite(raw) || raw < 5 || raw > 120) return 30;
  return raw;
}
