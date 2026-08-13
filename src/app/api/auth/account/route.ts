import { NextResponse } from "next/server";
import { jsonOk, jsonError, requireUser, ApiError } from "@/lib/api";
import {
  cancelOwnPendingPayment,
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

export async function POST(req: Request) {
  try {
    const user = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      transactionId?: string;
    };
    if (body.action === "cancel_pending" && body.transactionId) {
      const result = await cancelOwnPendingPayment(user.id, body.transactionId);
      const status = await getAccountDeletionBlockers(user.id);
      return jsonOk({ ...result, ...status });
    }
    throw new ApiError(400, "不正なリクエストです", "BAD_REQUEST");
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser(req);
    const result = await deleteAccount(user.id);
    const res = NextResponse.json(result);
    const clear = clearSessionCookieOptions();
    res.cookies.set(clear);
    return res;
  } catch (e) {
    return jsonError(e);
  }
}
