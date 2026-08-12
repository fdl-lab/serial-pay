# Serial Pay × Supabase セットアップ

このプロジェクトの DB は **Supabase の PostgreSQL** を使う（Prisma 接続）。

> Firestore ではなく、Supabase の **Database（Postgres）** を使うよ。

---

## 1. Supabase プロジェクト作成

1. [https://supabase.com](https://supabase.com) でサインイン
2. **New project** → リージョンは `Northeast Asia (Tokyo)` がおすすめ
3. DB パスワードを決めて **必ず控える**（後から再表示できない）

---

## 2. Connection string を取得

1. 左メニュー **Project Settings（歯車）→ Database**
2. **Connection string** → **URI**
3. 方式は次のどちらか:

| 用途 | 選ぶもの | メモ |
|------|----------|------|
| ローカル開発（Prisma） | **Session mode**（ポート `5432`）または **Direct** | 一番わかりやすい |
| サーバーレス大量接続 | **Transaction pooler**（`6543`） | Prisma なら `?pgbouncer=true` が必要なことあり |

**おすすめ（開発）: Direct connection / Session**

表示された URI の `[YOUR-PASSWORD]` を、作成時の DB パスワードに置き換える。

例:

```bash
DATABASE_URL="postgresql://postgres.xxxx:あなたのパスワード@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?schema=public"
```

または Direct:

```bash
DATABASE_URL="postgresql://postgres:あなたのパスワード@db.xxxx.supabase.co:5432/postgres?schema=public"
```

パスワードに `@` `#` などが入っている場合は [URLエンコード](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent) が必要。

---

## 3. `.env.local` を更新

`DATABASE_URL` を上の URI に書き換える。ほかは今のままでOK。

```bash
# 暗号化キー（未設定なら）
openssl rand -base64 32
openssl rand -base64 32
```

---

## 4. スキーマ反映 & シード

```bash
cd "/Users/szco/Desktop/Serial Pay"
npx prisma db push
npm run db:seed
```

seed 後に表示される ID を入れる:

```bash
DEV_USER_ID="cuid_xxx"
NEXT_PUBLIC_DEV_USER_ID="cuid_xxx"
```

確認:

```bash
npx prisma studio
```

Supabase ダッシュボードの **Table Editor** にも `users` / `wallets` などが見えるはず。

---

## 5. 開発サーバー再起動

```bash
# 動いていれば一度止めてから
npm run dev
```

`/me` がプレビューではなく実データになれば成功。

---

## 補足

- **Supabase Auth** はまだ未接続。今は `DEV_AUTH_BYPASS` + Prisma の `users` テーブル。
- 後で Auth を足すときは `src/lib/auth/session.ts` を差し替える想定。
- Stripe は別途（Dashboard の test key + `stripe listen`）。

## トラブル

| 症状 | 対処 |
|------|------|
| `Can't reach database` / timeout | Direct URL・パスワード・`ssl` を確認。会社ネットなら pooler を試す |
| `P1000 Authentication failed` | パスワード誤り or URLエンコード漏れ |
| Prisma と pooler でエラー | Direct（5432）に切り替え |
