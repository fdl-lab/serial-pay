import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { syncSupabaseUser } from "@/services/auth";
import { readSessionUserId } from "@/lib/auth/app-session";
import type { User } from "@prisma/client";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, { status: 200, ...init });
}

export function jsonCreated<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  console.error(error);
  if (isDbPoolExhausted(error)) {
    return NextResponse.json(
      {
        error:
          "ただいま混み合っています。しばらくしてからもう一度お試しください",
        code: "DB_POOL_EXHAUSTED",
      },
      { status: 503 },
    );
  }
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}

function devBypassUserId(req: Request): string | null {
  if (process.env.DEV_AUTH_BYPASS !== "true") return null;
  return req.headers.get("x-user-id") || process.env.DEV_USER_ID || null;
}

function previewUser(id: string): User {
  const now = new Date();
  return {
    id,
    createdAt: now,
    updatedAt: now,
    email: "preview@serial-pay.local",
    phoneE164: "+819000000000",
    phoneVerified: true,
    displayName: "プレビューユーザー",
    avatarUrl: null,
    lineUserId: null,
    publicId: "SP-PREVIEW1",
    profileCompletedAt: now,
    authProvider: "preview",
    authProviderId: null,
    ekycStatus: "APPROVED",
    ekycProviderId: null,
    ekycVerifiedAt: now,
    ekycRejectedReason: null,
    stripeCustomerId: null,
    stripeConnectAccountId: null,
    stripeConnectStatus: "NOT_CONNECTED",
    ratingScore: 0 as unknown as User["ratingScore"],
    ratingCount: 0,
    completedSales: 0,
    completedBuys: 0,
    disputeCountAsBuyer: 0,
    disputeCountAsSeller: 0,
    isSuspended: false,
    suspendedAt: null,
    suspendReason: null,
  };
}

function isDbUnavailable(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("Can't reach database") ||
    msg.includes("P1001") ||
    msg.includes("PrismaClientInitializationError") ||
    msg.includes("EMAXCONNSESSION") ||
    msg.includes("max clients reached")
  );
}

function isDbPoolExhausted(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("EMAXCONNSESSION") ||
    msg.includes("max clients reached") ||
    msg.includes("too many clients")
  );
}

/** 認証済み Prisma User。アプリセッション(LINE) → Supabase → DEV バイパス */
export async function requireUser(req: Request): Promise<User> {
  const sessionUserId = readSessionUserId(req.headers.get("cookie"));
  if (sessionUserId) {
    try {
      const user = await prisma.user.findUnique({ where: { id: sessionUserId } });
      if (user) {
        if (user.isSuspended) {
          throw new ApiError(
            403,
            user.suspendReason === "deleted"
              ? "退会済みのアカウントです"
              : "アカウントが停止されています",
            user.suspendReason === "deleted" ? "DELETED" : "SUSPENDED",
          );
        }
        return user;
      }
    } catch (e) {
      if (e instanceof ApiError) throw e;
      if (!(process.env.DEV_AUTH_BYPASS === "true" && isDbUnavailable(e))) {
        throw e;
      }
    }
  }

  const supabase = await createSupabaseServerClient();
  if (supabase) {
    const {
      data: { user: sbUser },
    } = await supabase.auth.getUser();
    if (sbUser) {
      const user = await syncSupabaseUser(sbUser);
      if (user.isSuspended) {
        throw new ApiError(
          403,
          user.suspendReason === "deleted"
            ? "退会済みのアカウントです"
            : "アカウントが停止されています",
          user.suspendReason === "deleted" ? "DELETED" : "SUSPENDED",
        );
      }
      return user;
    }
  }

  const userId = devBypassUserId(req);
  if (!userId) {
    throw new ApiError(401, "ログインが必要です", "UNAUTHORIZED");
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      if (process.env.DEV_AUTH_BYPASS === "true") return previewUser(userId);
      throw new ApiError(401, "ユーザーが見つかりません", "USER_NOT_FOUND");
    }
    if (user.isSuspended) {
      throw new ApiError(
        403,
        user.suspendReason === "deleted"
          ? "退会済みのアカウントです"
          : "アカウントが停止されています",
        user.suspendReason === "deleted" ? "DELETED" : "SUSPENDED",
      );
    }
    return user;
  } catch (e) {
    if (process.env.DEV_AUTH_BYPASS === "true" && isDbUnavailable(e)) {
      return previewUser(userId);
    }
    throw e;
  }
}

export function assertBuyerEligible(user: User) {
  if (!user.phoneVerified) {
    throw new ApiError(403, "LINEログインが完了していません", "PHONE_REQUIRED");
  }
  if (user.ekycStatus !== "APPROVED") {
    throw new ApiError(403, "eKYC（本人確認）が完了していません", "EKYC_REQUIRED");
  }
}

export function assertSellerEligible(user: User) {
  assertBuyerEligible(user);
}

export function assertPayoutEligible(user: User) {
  assertBuyerEligible(user);
  if (user.stripeConnectStatus !== "ACTIVE" || !user.stripeConnectAccountId) {
    throw new ApiError(
      403,
      "出金には Stripe Connect（銀行口座）の登録が必要です",
      "CONNECT_REQUIRED",
    );
  }
}
