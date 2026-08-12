import { NextResponse } from "next/server";
import { getMarketHint } from "@/services/listing";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const eventName = searchParams.get("eventName") ?? undefined;
  const hint = await getMarketHint(eventName);
  return NextResponse.json({ market: hint });
}
