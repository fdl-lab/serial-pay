import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { readAvatarObject } from "@/lib/storage/avatar";

type Ctx = { params: Promise<{ userId: string; filename: string }> };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { userId, filename } = await ctx.params;
    const { buffer, contentType } = await readAvatarObject(userId, filename);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (e) {
    return jsonError(e);
  }
}
