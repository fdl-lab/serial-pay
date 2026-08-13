# 本番化チェックリスト（あなたがやること）

いまのアプリは **テストStripe鍵** で動いてるよ。  
本当の課金・本人確認・出金を使うには、下をあなた側で進めてね。

本番URL: `https://serial-pay.vercel.app`

---

## 1. Stripe を Live にする（最重要）

Stripe Dashboard 右上を **Test mode OFF（本番）** にする。

### 1-1. APIキー
1. [API keys](https://dashboard.stripe.com/apikeys)
2. これをコピー:
   - `Publishable key` → `pk_live_...`
   - `Secret key` → `sk_live_...`
3. Cursor に貼るか、Vercel → Project → Settings → Environment Variables に入れる:
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_SECRET_KEY`
   - Environment: **Production**

### 1-2. Live Webhook（テスト用とは別）
1. [Webhooks](https://dashboard.stripe.com/webhooks)（※ Live mode）
2. Add endpoint  
   URL: `https://serial-pay.vercel.app/api/webhooks/stripe`
3. イベント:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `identity.verification_session.verified`
   - `identity.verification_session.requires_input`
   - `identity.verification_session.canceled`
4. Signing secret（`whsec_...`）を Vercel の  
   `STRIPE_WEBHOOK_SECRET`（Production）に入れる  
   ※ いま入ってるのは **テスト用** なので差し替え必須

### 1-3. Stripe Connect（出金）
1. Connect を有効化（プラットフォーム設定・ブランド情報）
2. 日本向けなら必要なビジネス情報・銀行情報を Stripe に提出
3. 出品者はマイページから Connect オンボード（本物の口座）

### 1-4. Stripe Identity（eKYC）
1. Identity を Live で有効化
2. 利用規約・プライバシーポリシーURLが求められる場合あり
3. 上記 Live Webhook に Identity イベントが入っていること

---

## 2. LINE Login（本番）

[LINE Developers](https://developers.line.biz/) → LINE Login チャネル:

コールバックURLに必ず入れる:

```text
https://serial-pay.vercel.app/api/auth/line/callback
```

（ローカル用 `http://127.0.0.1:3000/...` も残してOK）

Channel ID / Secret はテスト・本番で同じチャネルで使えることが多い。  
Vercel に `LINE_CHANNEL_ID` / `LINE_CHANNEL_SECRET` /  
`LINE_CALLBACK_URL=https://serial-pay.vercel.app/api/auth/line/callback` /  
`NEXT_PUBLIC_APP_URL=https://serial-pay.vercel.app` があるか確認。

---

## 3. Vercel 本番フラグ

Production でこれにする:

| 変数 | 値 |
|------|-----|
| `DEV_AUTH_BYPASS` | `false` |
| `NEXT_PUBLIC_DEV_AUTH_BYPASS` | `false` |
| `NEXT_PUBLIC_APP_URL` | `https://serial-pay.vercel.app` |
| `LINE_CALLBACK_URL` | `https://serial-pay.vercel.app/api/auth/line/callback` |

変更後は **Redeploy**。

---

## 4. あると安心（推奨）

| 項目 | 内容 |
|------|------|
| 画録ストレージ | R2/S3 のバケット + `S3_*` を Vercel に設定（異議動画） |
| 事務局 | `ADMIN_API_SECRET` を長いランダム文字列で設定 |
| Cron | `vercel.json` で毎時 `/api/cron/auto-complete`（未開示72h→売上確定＋★1 / 確認期限→自動完了）。`CRON_SECRET` 推奨 |
| 独自ドメイン | あるなら DNS → Vercel → LINE/Stripe のURLも更新 |
| 法務ページ | 利用規約・プライバシー・特商法 |

---

## 5. 通し確認（Live 切替後）

1. LINEログイン
2. eKYC（本物の本人確認）
3. 出品（少額）
4. 別アカウントで購入（少額カード）
5. 開示 → 受取確認 → 評価 → 完了
6. 出品者側で出金申請（Connect完了後）
7. 異議1件（画録添付）→ 事務局APIで許可/却下

---

## こちらに頼んでほしいとき

次をチャットに貼ってくれれば、Vercel へのセットと再デプロイまでやるよ:

```text
pk_live_...
sk_live_...
whsec_...（Live Webhook の Signing secret）
```

※ 鍵はチャットに貼ったあと、Stripe でローテできる前提で扱ってね。  
不安なら Vercel Dashboard に自分で入れて「入れたから再デプロイして」でもOK。
