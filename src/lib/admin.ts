import { ApiError } from "@/lib/api";

/** 事務局API: `x-admin-secret` が ADMIN_API_SECRET と一致すること */
export function assertAdmin(req: Request) {
  const secret = process.env.ADMIN_API_SECRET;
  const header = req.headers.get("x-admin-secret");

  if (secret && header === secret) return;

  // ローカル開発のみ、秘密未設定でも DEV バイパス可
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_AUTH_BYPASS === "true"
  ) {
    return;
  }

  if (!secret) {
    throw new ApiError(
      503,
      "ADMIN_API_SECRET が未設定です",
      "ADMIN_NOT_CONFIGURED",
    );
  }

  throw new ApiError(403, "管理者のみ操作できます", "FORBIDDEN");
}
