# Serial Pay — ディレクトリ構成（Web / PWA）

```
Serial Pay/
├── prisma/
│   └── schema.prisma          # User / Item / SerialCode / Transaction
│                              # Dispute / Wallet / PayoutRequest …
├── public/
│   ├── manifest.webmanifest   # PWA
│   ├── icons/                 # ホーム画面アイコン
│   └── sw.js                  # 簡易 Service Worker
├── scripts/
│   ├── seed.ts
│   └── auto-complete.ts       # 確認期限切れ → ウォレット反映
├── docs/
│   ├── SETUP.md               # 用意物・起動手順
│   └── ARCHITECTURE.md        # 本ファイル相当
├── src/
│   ├── app/
│   │   ├── layout.tsx         # モバイルシェル + PWA meta
│   │   ├── page.tsx           # LP（X流入向け）
│   │   ├── globals.css        # Tailwind + ブランドトークン
│   │   ├── sell/page.tsx
│   │   ├── me/page.tsx        # マイページ（残高・出金）
│   │   ├── transactions/[id]/
│   │   │   ├── page.tsx       # 即時開示
│   │   │   └── dispute/page.tsx
│   │   └── api/
│   │       ├── listings/
│   │       ├── checkout/      # Stripe / Wallet / Mixed
│   │       ├── webhooks/stripe/
│   │       ├── connect/onboard/
│   │       ├── market-stats/
│   │       ├── wallet/
│   │       │   ├── route.ts           # 残高取得
│   │       │   └── payout/route.ts    # 振込申請
│   │       └── transactions/[id]/
│   │           ├── reveal/
│   │           ├── confirm/
│   │           └── dispute/
│   ├── components/
│   │   ├── listing/ListingForm.tsx
│   │   ├── reveal/
│   │   │   ├── CodeRevealScreen.tsx
│   │   │   ├── CountdownTimer.tsx
│   │   │   └── RecordingWarningModal.tsx
│   │   ├── wallet/
│   │   │   ├── WalletBalanceCard.tsx
│   │   │   └── PayoutRequestModal.tsx
│   │   └── layout/
│   │       └── MobileNav.tsx
│   ├── services/              # ドメインロジック（既存維持＋拡張）
│   │   ├── listing.ts
│   │   ├── checkout.ts
│   │   ├── complete.ts        # 完了 → ウォレット加算
│   │   ├── dispute.ts
│   │   └── wallet.ts
│   └── lib/
│       ├── prisma.ts
│       ├── stripe.ts
│       ├── money.ts
│       ├── format.ts
│       ├── api.ts             # DEV_AUTH / 将来 NextAuth 差し替え点
│       ├── auth/              # NextAuth / Supabase 差し込み用
│       └── crypto/serial.ts
└── package.json
```

## 収益フロー（更新）

1. 購入 → Stripe / ウォレットで決済 → 運営エスクロー留保
2. 即パル（コード開示）+ 確認タイマー
3. 受取確認 or 期限切れ → **販売手数料10%差引後を出品者 Wallet に加算**
4. マイページから出金申請 → **振込手数料200円** を差し引き Stripe Payouts / Transfer
