import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "利用規約 | シリアルPay",
  description: "シリアルPayの利用規約です。",
};

export default function TermsPage() {
  return (
    <main className="space-y-6 pb-8">
      <nav className="nav">
        <Link href="/">← トップ</Link>
      </nav>

      <header className="card-surface space-y-2">
        <p className="brand-mark">シリアルPay</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          利用規約
        </h1>
        <p className="text-sm text-ink-soft">
          本規約は、FDL合同会社（以下「当社」）が提供する「シリアルPay」（以下「本サービス」）の利用条件を定めるものです。ご利用の前に必ずお読みください。
        </p>
        <p className="text-xs text-ink-soft">最終更新日：2026年8月18日</p>
      </header>

      <section className="card-surface prose-legal space-y-3 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-lg font-extrabold text-ink">第1条（適用）</h2>
        <p>
          本規約は、本サービスの利用に関する当社とユーザーとの一切の関係に適用されます。ユーザーは本規約に同意のうえ本サービスを利用するものとします。
        </p>
      </section>

      <section className="card-surface space-y-3 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-lg font-extrabold text-ink">第2条（サービスの内容）</h2>
        <p>
          本サービスは、ユーザー間でシリアルコード等のデジタルコンテンツを売買するためのプラットフォーム（場）を提供します。当社は原則として売買の当事者ではなく、決済の預託（エスクロー）、本人確認、異議受付等の仕組みを通じて取引を支援します。
        </p>
      </section>

      <section className="card-surface space-y-3 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-lg font-extrabold text-ink">
          第3条（アカウント・利用条件）
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>本サービスの利用には、LINEログインおよび当社所定の本人確認（eKYC）の完了が必要です。</li>
          <li>ユーザーは正確な情報を登録し、自己の責任でアカウントを管理するものとします。</li>
          <li>出金（振込）を行う場合は、当社が指定する決済・送金サービス（Stripe Connect等）への登録が必要です。</li>
          <li>当社が不適切と判断した場合、登録を拒否し、または利用を制限することがあります。</li>
        </ul>
      </section>

      <section className="card-surface space-y-3 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-lg font-extrabold text-ink">第4条（禁止事項）</h2>
        <p>ユーザーは、次の行為をしてはなりません。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>使用済み、偽造、存在しない、または入手経路が不正なシリアルの出品</li>
          <li>法令や主催者・提供元の規約で譲渡・売買が禁じられているコンテンツの出品</li>
          <li>サイト外での直接取引（直振り、外部SNS等への誘導を含む）</li>
          <li>虚偽の申告（使えたのに「使えなかった」として返金を求める等）</li>
          <li>購入意思のない購入、異議の乱用、システムの不正利用・妨害</li>
          <li>他のユーザーまたは第三者の権利・利益を侵害する行為</li>
          <li>その他、当社が不適切と判断する行為</li>
        </ul>
      </section>

      <section className="card-surface space-y-3 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-lg font-extrabold text-ink">
          第5条（売買・エスクロー・手数料）
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            購入代金は決済完了時に当社（または当社が利用する決済事業者）が一時預かりし、取引完了後に出品者の売上として反映されます。
          </li>
          <li>
            購入後の購入者都合によるキャンセルはできません。
          </li>
          <li>
            販売手数料として取引金額の13%を差し引きます。出金時は振込手数料200円（出金下限500円）がかかります。
          </li>
          <li>
            シリアルの開示、受取確認、評価、開示期限・確認期限、異議申し立ての詳細はサービス画面および
            <Link href="/guide" className="font-semibold text-mint-deep underline">
              ご利用ガイド
            </Link>
            に従います。
          </li>
          <li>
            開示期限までに一度も開示しない場合、返金なしで取引完了扱いとなり、出品者へ売上が確定することがあります。
          </li>
        </ul>
      </section>

      <section className="card-surface space-y-3 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-lg font-extrabold text-ink">第6条（トラブル・異議）</h2>
        <p>
          開示したコードが無効・使用済み等である場合、ユーザーは取引完了前に所定の方法で異議申し立てを行うことができます。当社は提出資料等を確認のうえ、返金許可または却下等を判断します。取引完了後の返金には原則として応じられません。
        </p>
      </section>

      <section className="card-surface space-y-3 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-lg font-extrabold text-ink">第7条（免責）</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            本サービスで取引されたシリアルの使用により、イベント主催者やコンテンツ提供元からペナルティ（抽選無効、入場拒否、アカウント凍結等）を受けた場合でも、当社は責任を負いません。
          </li>
          <li>
            ユーザー間の紛争について、当社は合理的な範囲で支援しますが、解決を保証するものではありません。
          </li>
          <li>
            通信障害、天災、第三者サービス（決済・本人確認・ログイン等）の不具合等により生じた損害について、当社に故意または重過失がある場合を除き責任を負いません。
          </li>
        </ul>
      </section>

      <section className="card-surface space-y-3 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-lg font-extrabold text-ink">
          第8条（利用停止・アカウント措置）
        </h2>
        <p>
          ユーザーが本規約に違反し、または違反のおそれがあると当社が判断した場合、事前通知なく、出品の非公開、取引制限、アカウント停止、売上の留保・没収、退会処理等の措置を行うことがあります。
        </p>
      </section>

      <section className="card-surface space-y-3 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-lg font-extrabold text-ink">第9条（規約の変更）</h2>
        <p>
          当社は必要に応じて本規約を変更できます。変更後の規約は、本サービス上に表示した時点から効力を生じます。変更後に本サービスを利用した場合、変更に同意したものとみなします。
        </p>
      </section>

      <section className="card-surface space-y-3 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-lg font-extrabold text-ink">第10条（準拠法・管轄）</h2>
        <p>
          本規約は日本法に準拠します。本サービスに関して紛争が生じた場合、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
        </p>
      </section>

      <section className="card-surface space-y-2 text-sm leading-relaxed text-ink-soft">
        <h2 className="text-lg font-extrabold text-ink">お問い合わせ</h2>
        <p>
          FDL合同会社
          <br />
          メール：
          <a
            href="mailto:info@f-d-l.jp"
            className="font-semibold text-mint-deep underline"
          >
            info@f-d-l.jp
          </a>
        </p>
      </section>
    </main>
  );
}
