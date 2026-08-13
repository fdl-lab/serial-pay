# Stripe Webhook セットアップ

エンドポイント（本番）:

```text
https://serial-pay.vercel.app/api/webhooks/stripe
```

ローカル開発は Stripe CLI 推奨:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

表示された `whsec_...` を `.env.local` の `STRIPE_WEBHOOK_SECRET` に入れる。

## 購読するイベント（必須）

アプリが処理しているもの:

| イベント | 用途 |
|---------|------|
| `payment_intent.succeeded` | 決済成功 → コード割当・エスクロー |
| `payment_intent.payment_failed` | 決済失敗 → 在庫戻し・ウォレット返金 |
| `payment_intent.canceled` | 決済キャンセル → 同上 |
| `identity.verification_session.verified` | eKYC 承認 |
| `identity.verification_session.requires_input` | eKYC 要再提出 |
| `identity.verification_session.canceled` | eKYC キャンセル |

## Stripe Dashboard での作成手順

1. [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. **Add endpoint**
3. Endpoint URL: `https://serial-pay.vercel.app/api/webhooks/stripe`
4. 上のイベントを選択（Search events で追加）
5. **Add endpoint** → **Reveal** で Signing secret（`whsec_...`）をコピー
6. Vercel の Production 環境変数 `STRIPE_WEBHOOK_SECRET` に貼る
7. 再デプロイ（env 反映のため）

### テストモード / ライブモード

- テスト鍵（`sk_test_...`）で動かすなら **Test mode** の Webhooks で作る
- 本番課金（`sk_live_...`）なら **Live mode** でも同じURL・同じイベントで作る  
  ※ Signing secret は test / live で別物。Vercel の鍵モードと合わせる

## 動作確認

Dashboard の Webhook → 該当 endpoint → **Send test webhook**  
または実決済・eKYC を1回通す。

成功時はアプリが `{"received":true}` を返し、イベント一覧が緑になる。

失敗しやすい点:

- URL の typo（`/api/webhooks/stripe`）
- `STRIPE_WEBHOOK_SECRET` が古い / test・live 不一致
- イベントを購読し忘れ（とくに Identity）
