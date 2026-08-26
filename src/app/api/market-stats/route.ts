import { jsonOk } from "@/lib/api";

/** イベント別相場・出品数の集計は提供しない（暗号化保管・非集計方針） */
export async function GET() {
  return jsonOk({ market: null });
}
