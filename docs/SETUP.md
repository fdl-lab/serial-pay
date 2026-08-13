# あなたが用意するもの（Serial Pay Web / PWA）

## DB: Supabase（推奨）

手順の詳細は **[SUPABASE.md](./SUPABASE.md)**。

1. Supabase でプロジェクト作成（Tokyo 推奨）
2. **Settings → Database → Connection string (URI)** をコピー
3. `.env.local` の `DATABASE_URL` に貼る（パスワード置換）
4. `npx prisma db push` → `npm run db:seed`
5. 出た user id を `DEV_USER_ID` / `NEXT_PUBLIC_DEV_USER_ID` にセット

## 必須（ローカル）

| 用意するもの | 環境変数 |
|-------------|---------|
| **Supabase Postgres** | `DATABASE_URL` |
| 暗号化キー ×2（`openssl rand -base64 32`） | `SERIAL_ENCRYPTION_KEY` / `SERIAL_CODE_HASH_PEPPER` |
| Stripe API keys + Connect 有効化 | `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| Webhook（決済 + Identity） | `STRIPE_WEBHOOK_SECRET` ※手順は [STRIPE_WEBHOOK.md](./STRIPE_WEBHOOK.md) |
| seed 後のユーザーID | `DEV_USER_ID` / `NEXT_PUBLIC_DEV_USER_ID` |

## 本番追加

| 用意するもの | 用途 |
|-------------|------|
| SMS（Twilio 等） | 電話認証 |
| eKYC（Stripe Identity 等） | 本人確認 |
| Supabase Auth / NextAuth | 本番セッション（`src/lib/auth/session.ts` 差し替え） |
| S3 / R2 / Supabase Storage | 画録動画 |
| ドメイン + HTTPS | PWA / Webhook / Connect return |
| Cron | `npm run jobs:auto-complete`（期限切れ→ウォレット反映） |

## 収益モデル（実装済み）

- 販売手数料 **10%** … 取引完了時に差引 → 出品者 **Wallet** へ加算
- 出金振込手数料 **一律 200円** … `/api/wallet/payout`
- 残高は購入に再利用可（`useWalletYen`）

## 起動

```bash
# .env.local に DATABASE_URL（Supabase）を設定済みの前提
npm install
npx prisma db push
npm run db:seed
npm run dev
```

- `/` LP · `/sell` 出品 · `/me` マイページ · `/transactions/:id` 即時開示
