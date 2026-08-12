# SMS + eKYC セットアップ（Supabase Auth + Stripe Identity）

購入・出品には **SMS認証** と **eKYC（本人確認）** の両方が必要です。

## 1. Supabase Auth（SMS / OTP）

### Dashboard 設定

1. [Supabase Dashboard](https://supabase.com/dashboard) → プロジェクト → **Authentication**
2. **Providers** → **Phone** を有効化
3. SMS プロバイダを設定（Twilio / MessageBird 等）
   - 日本向けは Twilio が一般的
   - テスト中は Supabase のテスト番号機能も利用可（プランによる）

### 環境変数

`.env.local` に追加:

```env
NEXT_PUBLIC_SUPABASE_URL="https://xxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
```

取得先: **Project Settings → API**

### アプリ側フロー

1. `/auth` … 電話番号入力 → OTP 検証
2. `POST /api/auth/sync` … Supabase ユーザー ↔ Prisma `User` 同期（`phoneVerified` 更新）
3. `/verify` … eKYC ステップへ

## 2. Stripe Identity（eKYC）

### Dashboard 設定

1. [Stripe Dashboard](https://dashboard.stripe.com/) → **Identity** を有効化
2. **Developers → Webhooks** でエンドポイント追加:
   - URL: `https://your-domain/api/webhooks/stripe`
   - イベント:
     - `identity.verification_session.verified`
     - `identity.verification_session.requires_input`
     - `identity.verification_session.canceled`
     - （決済用）`payment_intent.succeeded` など既存イベントも含める

### 環境変数

```env
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### アプリ側フロー

1. SMS 完了後 `/verify` で「本人確認を始める」
2. `POST /api/ekyc/start` → Stripe Identity URL へリダイレクト
3. 完了後 `return_url`（`/verify?ekyc=return`）へ戻る
4. Webhook で `User.ekycStatus` を `APPROVED` に更新

## 3. 開発モード（認証スキップ）

Supabase 未設定でも開発できるように `DEV_AUTH_BYPASS` を残しています。

```env
DEV_AUTH_BYPASS="true"
DEV_USER_ID="seedのbuyerまたはsellerのcuid"
NEXT_PUBLIC_DEV_USER_ID="同上"
```

`apiFetch` が自動で `x-user-id` ヘッダを付与します。  
本番では `DEV_AUTH_BYPASS=false` にし、Supabase セッションのみ使ってください。

## 4. 関連 API

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/auth/me` | 認証・eKYC ステータス |
| POST | `/api/auth/sync` | Supabase → Prisma 同期 |
| POST | `/api/ekyc/start` | Stripe Identity セッション開始 |

## 5. Prisma フィールド

`User` モデル:

- `phoneVerified` … SMS 完了
- `phoneE164` … 国際形式の電話番号
- `authProvider` / `authProviderId` … Supabase ユーザー ID
- `ekycStatus` … `PENDING` / `SUBMITTED` / `APPROVED` / `REJECTED`
- `ekycProviderId` … Stripe Verification Session ID

## 6. ローカル Webhook テスト

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

表示された `whsec_...` を `STRIPE_WEBHOOK_SECRET` に設定。
