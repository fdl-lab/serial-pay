# LINE Login + eKYC セットアップ

購入・出品には **LINEログイン** と **eKYC（本人確認）** の両方が必要です。

> 注意: Supabase Auth には LINE プロバイダが無い環境があるため、  
> **アプリが直接 LINE Login する方式**にしています（Supabase Providers の LINE 設定は不要）。

## 1. LINE Developers

1. [LINE Developers](https://developers.line.biz/) で **LINE Login** チャネルを作成
2. **Channel ID** / **Channel secret** を控える
3. **LINEログイン設定 → コールバックURL** に次を登録（一字一句同じ）:

```text
http://127.0.0.1:3000/api/auth/line/callback
```

本番では（使っているURLをすべて登録）:

```text
https://www.serial-pay.com/api/auth/line/callback
https://serial-pay.com/api/auth/line/callback
https://serial-pay.vercel.app/api/auth/line/callback
http://127.0.0.1:3000/api/auth/line/callback
```

※ 以前の `https://xxxx.supabase.co/auth/v1/callback` は使わない（削除してOK）

4. 権限: `profile` / `openid`（email は任意）

## 2. 環境変数

### ローカル（`.env.local`）

```env
LINE_CHANNEL_ID="1234567890"
LINE_CHANNEL_SECRET="xxxxxxxx"
LINE_CALLBACK_URL="http://127.0.0.1:3000/api/auth/line/callback"
NEXT_PUBLIC_APP_URL="http://127.0.0.1:3000"
```

### 本番（Vercel）

```env
LINE_CHANNEL_ID="（同じでOK）"
LINE_CHANNEL_SECRET="（同じでOK）"
LINE_CALLBACK_URL="https://www.serial-pay.com/api/auth/line/callback"
NEXT_PUBLIC_APP_URL="https://www.serial-pay.com"
```

アプリは本番ホストからのログイン時、**いま開いているドメイン**の callback を使います。  
そのため **LINE Developers に www / apex / vercel など実際に使うURLをすべて登録**してください。

## 3. アプリ側フロー

1. `/auth` … 「LINEでログイン」
2. `/api/auth/line/start` … LINE へリダイレクト
3. `/api/auth/line/callback` … トークン交換 → Prisma User 作成 → セッションCookie
4. `/verify` … eKYC（Stripe Identity）

## 4. Stripe Identity（eKYC）

従来どおり Identity 有効化 + Webhook（`identity.verification_session.*`）。

## 5. 開発バイパス

```env
DEV_AUTH_BYPASS="false"
NEXT_PUBLIC_DEV_AUTH_BYPASS="false"
```

## エラー別チェック

| 症状 | 確認 |
|------|------|
| `line_config` | `.env.local` の CHANNEL_ID / SECRET |
| `line_callback` / token error | コールバックURLの不一致（`localhost` vs `127.0.0.1`、www 未登録） |
| `line_state` | 署名付き state で緩和済み。まだ出る場合は再試行 |
