import { NextResponse } from "next/server";
import { jsonError, ApiError } from "@/lib/api";
import { readLocalAvatar } from "@/lib/storage/avatar";

type Ctx = { params: Promise<{ userId: string; filename: string }> };

export const runtime = "nodejs";

function mimeFromName(name: string) {
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { userId, filename } = await ctx.params;
    const buf = await readLocalAvatar(userId, filename);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": mimeFromName(filename),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (e) {
    if (e instanceof Error && "code" in e) return jsonError(e);
    return jsonError(new ApiError(404, "画像が見つかりません", "NOT_FOUND"));
  }
}
