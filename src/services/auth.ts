import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import type { VerificationStatus } from "@/types/auth";
import type { LineProfile } from "@/lib/line/oauth";

export { toE164Japan } from "@/lib/phone";

function syntheticEmail(prefix: string, id: string): string {
  return `${prefix}_${id.replace(/-/g, "")}@serial-pay.local`;
}

function isLineUser(supabaseUser: SupabaseUser): boolean {
  const identities = supabaseUser.identities ?? [];
  if (identities.some((i) => i.provider === "line")) return true;
  const providers = supabaseUser.app_metadata?.providers;
  return Array.isArray(providers) && providers.includes("line");
}

function displayNameFrom(supabaseUser: SupabaseUser, isLine: boolean): string {
  const meta = supabaseUser.user_metadata ?? {};
  const name =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    (typeof meta.user_name === "string" && meta.user_name) ||
    null;
  if (name) return name;
  if (supabaseUser.phone) return `ユーザー${supabaseUser.phone.slice(-4)}`;
  return isLine ? "LINEユーザー" : "ユーザー";
}

/** LINE Login（アプリ直結）→ Prisma User */
export async function syncLineUser(profile: LineProfile): Promise<User> {
  const authProviderId = `line:${profile.userId}`;
  const email = profile.email || syntheticEmail("line", profile.userId);

  const existing = await prisma.user.findUnique({
    where: { authProviderId },
  });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        phoneVerified: true,
        displayName: profile.displayName || existing.displayName,
        avatarUrl: profile.pictureUrl ?? existing.avatarUrl,
        authProvider: "line",
        email: profile.email || existing.email,
      },
    });
  }

  return prisma.user.create({
    data: {
      email,
      authProvider: "line",
      authProviderId,
      phoneVerified: true,
      displayName: profile.displayName || "LINEユーザー",
      avatarUrl: profile.pictureUrl ?? null,
      ekycStatus: "PENDING",
    },
  });
}

/**
 * Supabase Auth ユーザー → Prisma User 同期
 */
export async function syncSupabaseUser(supabaseUser: SupabaseUser): Promise<User> {
  const isLine = isLineUser(supabaseUser);
  const phoneE164 = supabaseUser.phone ?? null;
  const loginVerified = Boolean(supabaseUser.phone_confirmed_at) || isLine;
  const email = supabaseUser.email ?? syntheticEmail("user", supabaseUser.id);
  const displayName = displayNameFrom(supabaseUser, isLine);
  const avatarUrl =
    typeof supabaseUser.user_metadata?.avatar_url === "string"
      ? supabaseUser.user_metadata.avatar_url
      : typeof supabaseUser.user_metadata?.picture === "string"
        ? supabaseUser.user_metadata.picture
        : null;
  const authProvider = isLine ? "line" : phoneE164 ? "phone" : "supabase";

  const existing = await prisma.user.findUnique({
    where: { authProviderId: supabaseUser.id },
  });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        phoneE164: phoneE164 ?? existing.phoneE164,
        phoneVerified: loginVerified || existing.phoneVerified,
        email: supabaseUser.email ?? existing.email,
        displayName: displayName || existing.displayName,
        avatarUrl: avatarUrl ?? existing.avatarUrl,
        authProvider,
      },
    });
  }

  if (phoneE164) {
    const byPhone = await prisma.user.findUnique({ where: { phoneE164 } });
    if (byPhone) {
      return prisma.user.update({
        where: { id: byPhone.id },
        data: {
          authProvider,
          authProviderId: supabaseUser.id,
          phoneVerified: loginVerified || byPhone.phoneVerified,
          displayName: displayName || byPhone.displayName,
          avatarUrl: avatarUrl ?? byPhone.avatarUrl,
        },
      });
    }
  }

  return prisma.user.create({
    data: {
      email,
      authProvider,
      authProviderId: supabaseUser.id,
      phoneE164,
      phoneVerified: loginVerified,
      displayName,
      avatarUrl,
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
    authProvider: user.authProvider,
    ekycStatus: user.ekycStatus,
    ekycVerifiedAt: user.ekycVerifiedAt,
    canBuy: verified,
    canSell: verified,
  };
}
