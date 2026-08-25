import { z } from "zod";
import { jsonOk, jsonError, ApiError } from "@/lib/api";

const CONTACT_TO = process.env.CONTACT_TO_EMAIL?.trim() || "info@serial-pay.com";
const CONTACT_FROM =
  process.env.CONTACT_FROM_EMAIL?.trim() ||
  "シリアルPay <onboarding@resend.dev>";

const schema = z.object({
  subject: z.string().min(1).max(120),
  name: z.string().min(1).max(80),
  email: z.string().email().max(200),
  body: z.string().min(1).max(5000),
  // ボット対策（人間は空のまま）
  website: z.string().max(0).optional(),
});

export async function POST(req: Request) {
  try {
    const raw = await req.json().catch(() => null);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new ApiError(400, "入力内容を確認してください", "VALIDATION");
    }

    const { subject, name, email, body, website } = parsed.data;
    if (website) {
      // honeypot: 成功したふり
      return jsonOk({ ok: true });
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      throw new ApiError(
        503,
        "メール送信の設定がまだ完了していません。しばらくしてから再度お試しください",
        "MAIL_NOT_CONFIGURED",
      );
    }

    const text = [
      `【シリアルPay お問い合わせ】`,
      ``,
      `件名: ${subject}`,
      `お名前: ${name}`,
      `返信先: ${email}`,
      ``,
      body,
    ].join("\n");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: CONTACT_FROM,
        to: [CONTACT_TO],
        reply_to: email,
        subject: `【シリアルPay】${subject}`,
        text,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("Resend error", res.status, errText);
      throw new ApiError(
        502,
        "メールの送信に失敗しました。時間をおいて再度お試しください",
        "MAIL_SEND_FAILED",
      );
    }

    return jsonOk({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
