import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "特定商取引法に基づく表記 | シリアルPay",
  description: "シリアルPay（FDL合同会社）の特定商取引法に基づく表記です。",
};

function Row({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b border-ink/10 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-sm font-bold text-ink">{label}</dt>
      <dd className="text-sm leading-relaxed text-ink-soft">{children}</dd>
    </div>
  );
}

export default function TokushohoPage() {
  return (
    <main className="space-y-6 pb-8">
      <nav className="nav">
        <Link href="/">← トップ</Link>
      </nav>

      <header className="card-surface space-y-2">
        <p className="brand-mark">シリアルPay</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          特定商取引法に基づく表記
        </h1>
        <p className="text-sm text-ink-soft">
          本サービス「シリアルPay」に関する表記です。
        </p>
      </header>

      <section className="card-surface">
        <dl>
          <Row label="販売業者">FDL合同会社</Row>
          <Row label="運営責任者">
            請求があった場合に遅滞なく開示いたします。ご希望の方は
            <Link
              href="/contact"
              className="font-semibold text-mint-deep underline"
            >
              お問い合わせフォーム
            </Link>
            よりご請求ください。
          </Row>
          <Row label="所在地">
            〒107-0061
            <br />
            東京都港区北青山1丁目3番1号 アールキューブ青山3階
          </Row>
          <Row label="連絡先">
            メール：
            <a
              href="mailto:info@f-d-l.jp"
              className="font-semibold text-mint-deep underline"
            >
              info@f-d-l.jp
            </a>
            <br />
            <span className="text-xs">
              ※電話番号はご請求いただいた場合に遅滞なく開示いたします。ご希望の方は
              <Link
                href="/contact"
                className="font-semibold text-mint-deep underline"
              >
                お問い合わせフォーム
              </Link>
              よりご請求ください。
            </span>
          </Row>
          <Row label="販売価格">
            各出品ページに表示する商品代金のほか、当社のシステム利用料（販売手数料）として取引金額の
            <strong className="text-ink">13%</strong>
            を差し引きます（取引完了時）。
          </Row>
          <Row label="商品代金以外の料金">
            出品者が売上金を出金する際、振込手数料として
            <strong className="text-ink">一律200円</strong>
            がかかります。出金額は500円以上です。
            <br />
            クレジットカード決済時には、決済事業者（Stripe）の手数料が別途発生します。
          </Row>
          <Row label="支払方法">
            クレジットカード決済（Stripe）、および本サービス内の売上金残高による支払い（併用を含む場合があります）。
          </Row>
          <Row label="支払時期">
            購入手続き時に即時決済・預託（エスクロー）されます。
          </Row>
          <Row label="役務の提供時期">
            決済完了後、購入者は取引画面からシリアルコードを開示できます。
            出品者への売上反映は、受取確認・評価による取引完了時、または所定の期限による自動完了時です。
          </Row>
          <Row label="返品・キャンセル">
            デジタルコンテンツ（シリアルコード）の性質上、購入後の購入者都合によるキャンセルはできません。
            <br />
            取引完了（受取確認・評価の完了、または期限による自動完了）後の返品・返金にも応じられません。
            <br />
            開示したコードが使用済み・無効等であった場合は、取引完了前に、開示から使用確認までの画面録画等を添付のうえ異議申し立てを行ってください。事務局確認のうえ許可された場合、おおよそ1〜2週間を目安に返金対応します。
            <br />
            開示期限までに一度も開示しないまま期限を過ぎた場合は、返金対象外となります。詳細は
            <Link href="/guide" className="font-semibold text-mint-deep underline">
              ご利用ガイド
            </Link>
            および
            <Link href="/terms" className="font-semibold text-mint-deep underline">
              利用規約
            </Link>
            をご確認ください。
          </Row>
          <Row label="動作環境">
            最新のスマートフォンブラウザ、またはデスクトップブラウザを推奨します。LINEログインおよび本人確認（eKYC）が利用できる環境が必要です。
          </Row>
        </dl>
      </section>
    </main>
  );
}
