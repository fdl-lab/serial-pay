import { jsonError, ApiError } from "@/lib/api";

type Ctx = { params: Promise<{ userId: string; filename: string }> };

/** 旧ローカル保存互換。現在は data URL / S3 に移行済み */
export async function GET(_req: Request, _ctx: Ctx) {
  return jsonError(
    new ApiError(
      410,
      "この画像URLは使えなくなったよ。プロフィール画像を再度アップロードしてね",
      "AVATAR_GONE",
    ),
  );
}
