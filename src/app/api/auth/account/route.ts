import { NextResponse } from "next/server";
import { jsonOk, jsonError, requireUser } from "@/lib/api";
import {
  deleteAccount,
  getAccountDeletionBlockers,
} from "@/services/account";
import { clearSessionCookieOptions } from "@/lib/auth/app-session";

export async function GET(req: Request) {
  try {
    const user = await requireUser(req);
    const status = await getAccountDeletionBlockers(user.id);
    return jsonOk(status);
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser(req);
    await deleteAccount(user.id);
    const res = NextResponse.json({ deleted: true });
    const clear = clearSessionCookieOptions();
    res.cookies.set(clear);
    return res;
  } catch (e) {
    return jsonError(e);
  }
}
