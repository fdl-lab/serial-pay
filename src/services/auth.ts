import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import type { VerificationStatus } from "@/types/auth";

export { toE164Japan } from "@/lib/phone";

function syntheticEmail(supabaseId: string): string {
  return `phone_${supabaseId.replace(/-/g, "")}@serial-pay.local`;
}

/**
 * Supabase Auth ユーザー → Prisma User 同期
 * SMS 認証完了時に phoneVerified を true にする
 */
export async function syncSupabaseUser(supabaseUser: SupabaseUser): Promise<User> {
  const phoneE164 = supabaseUser.phone ?? null;
  const phoneVerified = Boolean(supabaseUser.phone_confirmed_at);
  const email = supabaseUser.email ?? syntheticEmail(supabaseUser.id);

  const existing = await prisma.user.findUnique({
    where: { authProviderId: supabaseUser.id },
  });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        phoneE164: phoneE164 ?? existing.phoneE164,
        phoneVerified: phoneVerified || existing.phoneVerified,
        email: supabaseUser.email ?? existing.email,
      },
    });
  }

  // 同じ電話番号の既存ユーザーがあれば紐付け（seed ユーザー等）
  if (phoneE164) {
    const byPhone = await prisma.user.findUnique({ where: { phoneE164 } });
    if (byPhone) {
      return prisma.user.update({
        where: { id: byPhone.id },
        data: {
          authProvider: "supabase",
          authProviderId: supabaseUser.id,
          phoneVerified: phoneVerified || byPhone.phoneVerified,
        },
      });
    }
  }

  return prisma.user.create({
    data: {
      email,
      authProvider: "supabase",
      authProviderId: supabaseUser.id,
      phoneE164,
      phoneVerified,
      displayName: phoneE164 ? `ユーザー${phoneE164.slice(-4)}` : "ユーザー",
      ekycStatus: "PENDING",
    },
  });
}

export function toVerificationStatus(user: User): VerificationStatus {
  const verified = user.phoneVerified && user.ekycStatus === "APPROVED";
  return {
    id: user.id,
    displayName: user.displayName,
    phoneVerified: user.phoneVerified,
    phoneE164: user.phoneE164,
    ekycStatus: user.ekycStatus,
    ekycVerifiedAt: user.ekycVerifiedAt,
    canBuy: verified,
    canSell: verified,
  };
}
