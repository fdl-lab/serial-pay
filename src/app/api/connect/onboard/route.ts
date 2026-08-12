import { jsonOk, jsonError, requireUser, ApiError } from "@/lib/api";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

function isStripeError(e: unknown): e is Stripe.errors.StripeError {
  return typeof e === "object" && e !== null && "type" in e;
}

/**
 * Stripe Connect Express オンボーディング URL を発行
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    if (!user.phoneVerified || user.ekycStatus !== "APPROVED") {
      throw new ApiError(403, "本人確認が完了していません", "EKYC_REQUIRED");
    }

    const stripe = getStripe();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    let accountId = user.stripeConnectAccountId;
    if (!accountId) {
      try {
        const account = await stripe.accounts.create({
          type: "express",
          country: "JP",
          email: user.email,
          capabilities: {
            transfers: { requested: true },
          },
          business_type: "individual",
          metadata: { userId: user.id },
        });
        accountId = account.id;
      } catch (e) {
        if (isStripeError(e)) {
          const msg = e.message ?? "";
          if (msg.includes("signed up for Connect") || msg.includes("Connect")) {
            throw new ApiError(
              400,
              "Stripe Dashboard で Connect を有効化してね（Settings → Connect → Get started）。テストモードでも必要だよ。",
              "CONNECT_PLATFORM_REQUIRED",
            );
          }
          throw new ApiError(400, msg || "Stripe Connect の開始に失敗したよ", "STRIPE_ERROR");
        }
        throw e;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          stripeConnectAccountId: accountId,
          stripeConnectStatus: "ONBOARDING",
        },
      });
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/me?connect=refresh`,
      return_url: `${appUrl}/me?connect=return`,
      type: "account_onboarding",
    });

    return jsonOk({ url: link.url, accountId });
  } catch (e) {
    return jsonError(e);
  }
}

/** オンボーディング完了後のステータス同期 */
export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    if (!user.stripeConnectAccountId) {
      return jsonOk({ status: "NOT_CONNECTED" });
    }
    const stripe = getStripe();
    const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);
    const active =
      account.charges_enabled && account.payouts_enabled ? "ACTIVE" : "ONBOARDING";

    await prisma.user.update({
      where: { id: user.id },
      data: { stripeConnectStatus: active },
    });

    return jsonOk({
      status: active,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
    });
  } catch (e) {
    return jsonError(e);
  }
}
