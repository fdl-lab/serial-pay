# Stripe Connect / Identity を Live（本番）で有効化する手順

Serial Pay での役割:

| 機能 | 誰が使う | 何のため |
|------|----------|----------|
| **Identity（eKYC）** | 購入者・出品者みんな | 本人確認（免許証等）。完了しないと売買不可 |
| **Connect Express** | 出品者 | 銀行口座登録 → 売上の出金 |

※ これは **あなたの会社（プラットフォーム）側** の Stripe 設定。  
出品者個人の口座登録は、あとでアプリのマイページ「銀行口座を登録」からやる。

---

## 事前確認

1. [Stripe Dashboard](https://dashboard.stripe.com) にログイン
2. 右上のトグルを **Test mode OFF（本番 / Live）** にする  
   ※ テストで有効でも、Live では別審査・別設定が必要
3. アカウントの国が **日本** であること

---

## A. Connect（出金）を本番で有効化

アプリは **Express アカウント + transfers** で出金しているよ。

### A-1. Connect を開始する

1. Dashboard 左メニュー **Connect**  
   または直接: https://dashboard.stripe.com/connect/overview  
2. **Get started / はじめる** があれば押す
3. プラットフォームの説明を求められるので、だいたいこう書く:

| 項目 | 記入例 |
|------|--------|
| 何のプラットフォームか | シリアルコード（電子チケット応募権）のC2Cマーケットプレイス |
| 誰が出品者か | 個人の推し活ユーザー（個人事業主含む） |
| お金の流れ | 購入者がカード決済 → 運営が一時預かり → 取引完了後に出品者へ送金 |
| 出金 | 出品者がアプリから出金申請 → Connect Express 経由で銀行振込 |

4. **事業情報（プラットフォーム自体）** を提出  
   - 会社名 or 屋号  
   - 代表者の本人確認  
   - 住所・電話  
   - 業種（マーケットプレイス / デジタル商品などに近いものを選択）  
   - サイトURL: `https://serial-pay.vercel.app`（独自ドメインがあればそれ）  
   - サポートメール  
   - 利用規約・プライバシーポリシーのURL（あるとスムーズ。なければ後で追加でも進む場合あり）

5. Stripe の審査が通るまで待つ（即日〜数日かかることあり）

審査中でも Test mode は使えるけど、**Live の出金は審査完了後**。

### A-2. Connect の設定（推奨）

https://dashboard.stripe.com/settings/connect

確認したいところ:

- **Express** が使えること
- オンボーディング対象国に **Japan** があること
- ブランディング（ロゴ・色・名前）… 出品者が見る Stripe 画面に出る
- サポート連絡先

### A-3. アプリ側で出品者がやること（あなた個人のテスト）

プラットフォーム審査が通ったあと:

1. Live 鍵を Vercel に入れた状態で https://serial-pay.vercel.app にログイン
2. eKYC 完了（Identity Live）
3. マイページ → **銀行口座を登録**（Connect オンボード）
4. Stripe の画面で本人情報・口座を入力
5. 戻ってきたらステータスが ACTIVE になればOK
6. 売上残高がある状態で出金申請（最低500円＋手数料200円）

### A-4. うまくいかないとき

| 症状 | 確認 |
|------|------|
| `Connect を有効化してね` | Live で Connect Get started 未完了 |
| オンボードURLが出ない | Live 鍵・`NEXT_PUBLIC_APP_URL` が本番HTTPSか |
| 口座登録後も ACTIVE にならない | Stripe Connect → Accounts で不足情報を確認 |
| Transfer 失敗 | プラットフォームの残高不足（購入が入ってない）/ 出品者の payouts_enabled が false |

---

## B. Identity（eKYC）を Live で有効化

アプリは `document` タイプ（運転免許証・マイナンバーカード・パスポート）で Verification Session を作っているよ。

### B-1. Identity を有効化する

1. Dashboard を **Live mode**
2. https://dashboard.stripe.com/identity または  
   https://dashboard.stripe.com/identity/application  
3. **Activate / 利用を開始 / Get started** を押す
4. 利用目的を聞かれたら例:

> C2Cマーケットプレイスの利用者本人確認。不正出品・なりすまし防止のため。

5. 利用規約への同意など、画面の指示どおり進める
6. 有効化完了まで待つ（審査がある場合あり）

料金は従量課金（本人確認1件ごと）。[料金ページ](https://stripe.com/identity#pricing) を確認してね。

### B-2. Webhook（Live）に Identity を入れる

Live Webhook  
`https://serial-pay.vercel.app/api/webhooks/stripe`  
に次が入っていること（必須）:

- `identity.verification_session.verified`
- `identity.verification_session.requires_input`
- `identity.verification_session.canceled`

これがないと、本人確認が Stripe 上で通っても **アプリ側が APPROVED にならない**。

### B-3. アプリ側の流れ（ユーザー視点）

1. LINEログイン
2. `/verify` で「本人確認をはじめる」
3. Stripe Identity の画面で書類撮影
4. 完了後アプリに戻る
5. Webhook で `ekycStatus = APPROVED`
6. 購入・出品・Connectオンボードが可能になる

### B-4. うまくいかないとき

| 症状 | 確認 |
|------|------|
| Identity 開始でエラー | Live で Identity 未アクティブ / 鍵が test のまま |
| 書類提出後も「審査中」 | Live Webhook の Identity イベント or `STRIPE_WEBHOOK_SECRET` が test用のまま |
| requires_input | 撮り直しが必要。ユーザーに再提出してもらう |
| return 後に戻らない | `NEXT_PUBLIC_APP_URL` が `https://serial-pay.vercel.app` か |

---

## C. 順番のおすすめ

1. Stripe アカウント自体の本人確認・事業情報（プラットフォーム）
2. **Identity Live 有効化**
3. **Connect Live 有効化・審査提出**
4. Live APIキー + Live Webhook を Vercel に設定 → 再デプロイ
5. 自分で通しテスト（ログイン → eKYC → 出品 → 購入 → 出金）

Identity と Connect はどちらを先でもよいけど、  
アプリ上は **eKYC完了後じゃないと Connect オンボードできない** ので、ユーザー体験的には Identity → Connect の順。

---

## D. ダッシュボード直リンク（Live）

- Connect 概要: https://dashboard.stripe.com/connect/overview  
- Connect 設定: https://dashboard.stripe.com/settings/connect  
- Identity: https://dashboard.stripe.com/identity  
- Webhooks: https://dashboard.stripe.com/webhooks  
- API keys: https://dashboard.stripe.com/apikeys  

（どれも右上が **Live** であること）
