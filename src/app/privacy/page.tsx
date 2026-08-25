import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "プライバシーポリシー | シリアルPay",
  description: "シリアルPayのプライバシーポリシー（個人情報保護方針）です。",
};

export default function PrivacyPage() {
  return (
    <main className="space-y-6 pb-8">
      <nav className="nav">
        <Link href="/">← トップ</Link>
      </nav>

      <header className="card-surface space-y-2">
        <p className="brand-mark">シリアルPay</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          プライバシーポリシー
        </h1>
        <p className="text-sm text-ink-soft">
          FDL合同会社（以下「当社」）は、本サービス「シリアルPay」における個人情報の取扱いについて、以下のとおり定めます。
        </p>
        <p className="text-xs text-ink-soft">最終更新日：2026年8月18日</p>
      </header>

      <section className="card-surface space-y-3 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-lg font-extrabold text-ink">1. 収集する情報</h2>
        <p>当社は、本サービスの提供にあたり、次のような情報を取得することがあります。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>アカウント情報（表示名、公開ID、プロフィール画像、LINE連携に伴う識別子等）</li>
          <li>連絡先情報（メールアドレス、電話番号等。取得する場合）</li>
          <li>本人確認に関する情報およびその処理結果（決済事業者が提供する本人確認サービス等を利用）</li>
          <li>取引情報（出品・購入履歴、決済金額、代金のお預かり状態、評価、異議内容、添付画録等）</li>
          <li>出金・振込に関する情報（Connect連携により決済事業者が取得・管理する口座情報を含む）</li>
          <li>端末・ログ情報（IPアドレス、ブラウザ情報、アクセス日時、Cookie等）</li>
        </ul>
      </section>

      <section className="card-surface space-y-3 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-lg font-extrabold text-ink">2. 利用目的</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>本サービスの提供、取引仲介、本人確認、不正利用の防止・対応</li>
          <li>決済、売上管理、出金処理、カスタマーサポート</li>
          <li>利用規約違反への対応、紛争・異議の審査</li>
          <li>サービス改善、障害対応、セキュリティ確保</li>
          <li>法令に基づく対応、重要なお知らせの送付</li>
        </ul>
      </section>

      <section className="card-surface space-y-3 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-lg font-extrabold text-ink">3. 第三者提供・委託</h2>
        <p>
          当社は、利用目的の達成に必要な範囲で、業務委託先に個人情報の取扱いを委託することがあります。主な委託・連携先は次のとおりです。
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>決済・本人確認・送金：Stripe, Inc. およびその関連会社</li>
          <li>認証・ログイン：LINEヤフー株式会社等（LINE Login）</li>
          <li>データベース・ホスティング：Supabase、Vercel 等</li>
          <li>異議画録等のファイル保管：オブジェクトストレージ事業者</li>
        </ul>
        <p>
          法令に基づく場合、または本人の同意がある場合を除き、上記以外に個人情報を第三者へ販売・提供しません。
        </p>
      </section>

      <section className="card-surface space-y-3 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-lg font-extrabold text-ink">
          4. Cookie・アクセス解析
        </h2>
        <p>
          本サービスは、セッション維持、ログイン状態の確認、不正防止、利便性向上のため Cookie
          や類似技術を使用します。ブラウザ設定により Cookie を無効化できますが、その場合本サービスの一部機能が利用できなくなることがあります。
        </p>
        <p>
          今後、アクセス解析ツールを導入する場合は、本ポリシーまたはサービス上でお知らせします。
        </p>
      </section>

      <section className="card-surface space-y-3 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-lg font-extrabold text-ink">5. 安全管理</h2>
        <p>
          当社は、個人情報の漏えい、滅失、毀損等を防止するため、アクセス制御、通信の暗号化、権限管理など、合理的な安全管理措置を講じます。シリアルコード等は適切に保護したうえで取り扱います。
        </p>
      </section>

      <section className="card-surface space-y-3 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-lg font-extrabold text-ink">
          6. 開示・訂正・削除等
        </h2>
        <p>
          ご本人から、保有個人データの開示・訂正・利用停止・削除等のご請求があった場合、法令に従い、本人確認のうえ合理的な範囲で対応します。退会手続きによりアカウントを削除した場合でも、法令・紛争対応・不正防止等のため、必要な範囲で情報を一定期間保持することがあります。
        </p>
      </section>

      <section className="card-surface space-y-3 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-lg font-extrabold text-ink">7. ポリシーの変更</h2>
        <p>
          本ポリシーの内容は、必要に応じて改定することがあります。重要な変更がある場合は、本サービス上で告知します。
        </p>
      </section>

      <section className="card-surface space-y-2 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-lg font-extrabold text-ink">8. お問い合わせ窓口</h2>
        <p>
          個人情報の取扱いに関するお問い合わせは、下記までご連絡ください。
          <br />
          <br />
          FDL合同会社
          <br />
          メール：
          <a
            href="mailto:info@serial-pay.com"
            className="font-semibold text-mint-deep underline"
          >
            info@serial-pay.com
          </a>
          <br />
          所在地：東京都港区北青山1丁目3番1号 アールキューブ青山3階
        </p>
      </section>
    </main>
  );
}
