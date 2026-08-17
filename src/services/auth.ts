import { z } from "zod";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import type { VerificationStatus } from "@/types/auth";
import type { LineProfile } from "@/lib/line/oauth";
import { allocatePublicId, ensurePublicId } from "@/lib/public-id";
import { ApiError } from "@/lib/api";
import {
  assertLineCanSignIn,
  linkLineIdentityToUser,
} from "@/services/line-identity";

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

async function withPublicId(user: User): Promise<User> {
  if (user.publicId) return user;
  const publicId = await allocatePublicId();
  return prisma.user.update({
    where: { id: user.id },
    data: { publicId },
  });
}

/** LINE Login（アプリ直結）→ Prisma User
 * 退会後は同じアカウントは復活しない。クールダウン後は新規 User。
 */
export async function syncLineUser(
  profile: LineProfile,
): Promise<{ user: User; created: boolean }> {
  const lineUserId = profile.userId;
  const authProviderId = `line:${lineUserId}`;
  const email = profile.email || syntheticEmail("line", lineUserId);

  const existing = await prisma.user.findUnique({
    where: { authProviderId },
  });

  if (existing) {
    if (existing.isSuspended) {
      throw new ApiError(
        403,
        existing.suspendReason === "deleted"
          ? "退会済みのアカウントです"
          : "アカウントが停止されています",
        existing.suspendReason === "deleted" ? "DELETED" : "SUSPENDED",
      );
    }
    // 有効な既存アカウント → クールダウン対象外でログイン
    await assertLineCanSignIn(lineUserId, { allowActiveLogin: true });
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        phoneVerified: true,
        displayName: existing.displayName || profile.displayName || "LINEユーザー",
        avatarUrl: existing.avatarUrl || profile.pictureUrl || null,
        authProvider: "line",
        lineUserId,
        email: profile.email || existing.email,
        publicId: existing.publicId || (await allocatePublicId()),
      },
    });
    await linkLineIdentityToUser(lineUserId, user.id);
    return { user, created: false };
  }

  // 新規（または退会後の再登録）→ BAN / クールダウン検査
  await assertLineCanSignIn(lineUserId, { allowActiveLogin: false });

  const user = await prisma.user.create({
    data: {
      email,
      authProvider: "line",
      authProviderId,
      lineUserId,
      phoneVerified: true,
      displayName: profile.displayName || "LINEユーザー",
      avatarUrl: profile.pictureUrl ?? null,
      publicId: await allocatePublicId(),
      ekycStatus: "PENDING",
    },
  });
  await linkLineIdentityToUser(lineUserId, user.id);
  return { user, created: true };
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
    const nextPhone = phoneE164 ?? existing.phoneE164;
    const nextVerified = loginVerified || existing.phoneVerified;
    const nextEmail = supabaseUser.email ?? existing.email;
    const nextDisplay = existing.displayName || displayName;
    const nextAvatar = existing.avatarUrl || avatarUrl;
    const needsPublicId = !existing.publicId;
    const unchanged =
      !needsPublicId &&
      existing.phoneE164 === nextPhone &&
      existing.phoneVerified === nextVerified &&
      existing.email === nextEmail &&
      existing.displayName === nextDisplay &&
      existing.avatarUrl === nextAvatar &&
      existing.authProvider === authProvider;

    if (unchanged) return existing;

    return prisma.user.update({
      where: { id: existing.id },
      data: {
        phoneE164: nextPhone,
        phoneVerified: nextVerified,
        email: nextEmail,
        displayName: nextDisplay,
        avatarUrl: nextAvatar,
        authProvider,
        publicId: existing.publicId || (await allocatePublicId()),
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
          displayName: byPhone.displayName || displayName,
          avatarUrl: byPhone.avatarUrl || avatarUrl,
          publicId: byPhone.publicId || (await allocatePublicId()),
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
      publicId: await allocatePublicId(),
      ekycStatus: "PENDING",
    },
  });
}

const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "名前を入力してください")
    .max(40, "名前は40文字以内にしてください"),
  avatarUrl: z.union([z.string().url(), z.null()]).optional(),
});

export async function updateProfile(userId: string, raw: unknown) {
  const input = profileSchema.parse(raw);
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      displayName: input.displayName,
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
      profileCompletedAt: new Date(),
    },
  });
  return withPublicId(user);
}

export function toVerificationStatus(user: User): VerificationStatus {
  const verified = user.phoneVerified && user.ekycStatus === "APPROVED";
  return {
    id: user.id,
    publicId: user.publicId,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    ratingScore: Number(user.ratingScore),
    ratingCount: user.ratingCount,
    profileCompletedAt: user.profileCompletedAt,
    phoneVerified: user.phoneVerified,
    phoneE164: user.phoneE164,
    authProvider: user.authProvider,
    ekycStatus: user.ekycStatus,
    ekycVerifiedAt: user.ekycVerifiedAt,
    canBuy: verified,
    canSell: verified,
  };
}

export async function getMeStatus(user: User): Promise<VerificationStatus> {
  const publicId = await ensurePublicId(user.id, user.publicId);
  return toVerificationStatus({ ...user, publicId });
}

export async function requireOwnedPublicId(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "ユーザーが見つかりません", "NOT_FOUND");
  return ensurePublicId(user.id, user.publicId);
}
