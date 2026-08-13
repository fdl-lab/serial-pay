import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { ApiError } from "@/lib/api";
import type { EkycStatus } from "@prisma/client";

export async function startStripeIdentityEkyc(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "ユーザーが見つかりません", "USER_NOT_FOUND");
  if (!user.phoneVerified) {
    throw new ApiError(403, "先にLINEログインを完了してください", "PHONE_REQUIRED");
  }
  if (user.ekycStatus === "APPROVED") {
    throw new ApiError(409, "本人確認は完了済みです", "EKYC_ALREADY_DONE");
  }

  const stripe = getStripe();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.identity.verificationSessions.create({
    type: "document",
    metadata: { userId: user.id },
    return_url: `${appUrl}/verify?ekyc=return`,
    options: {
      document: {
        allowed_types: ["driving_license", "id_card", "passport"],
      },
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ekycStatus: "SUBMITTED",
      ekycProviderId: session.id,
    },
  });

  if (!session.url) {
    throw new ApiError(500, "本人確認URLの取得に失敗しました", "EKYC_URL");
  }

  return { url: session.url, sessionId: session.id };
}

export async function applyEkycWebhook(
  sessionId: string,
  status: "verified" | "requires_input" | "canceled",
) {
  const user = await prisma.user.findFirst({
    where: { ekycProviderId: sessionId },
  });
  if (!user) {
    console.warn("eKYC webhook: user not found for session", sessionId);
    return;
  }

  const data: {
    ekycStatus: EkycStatus;
    ekycVerifiedAt?: Date;
    ekycRejectedReason?: string | null;
  } = { ekycStatus: user.ekycStatus };

  switch (status) {
    case "verified":
      data.ekycStatus = "APPROVED";
      data.ekycVerifiedAt = new Date();
      data.ekycRejectedReason = null;
      break;
    case "requires_input":
      data.ekycStatus = "SUBMITTED";
      break;
    case "canceled":
      data.ekycStatus = "REJECTED";
      data.ekycRejectedReason = "本人確認がキャンセルまたは却下されました";
      break;
    default:
      return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data,
  });
}
