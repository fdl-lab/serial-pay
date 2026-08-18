import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "ご利用ガイド | シリアルPay",
  description:
    "シリアルPayの取引の流れ、よくある質問、禁止事項・免責事項のご案内です。",
};

export default function GuidePage() {
  return (
    <main className="space-y-6 pb-8">
      <nav className="nav">
        <Link href="/">← トップ</Link>
      </nav>

      <header className="card-surface space-y-2">
        <p className="brand-mark">シリアルPay</p>
        <h1 className="text-3xl font-extrabold tracking-tight">ご利用ガイド</h1>
        <p className="text-ink-soft leading-relaxed">
          シリアルコードの売買を、エスクロー決済で安全に行うためのガイドです。
          ご利用前に一度お読みください。
        </p>
      </header>

      <section className="card-surface space-y-4">
        <h2 className="text-xl font-extrabold tracking-tight">初めての方へ（取引の流れ）</h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          代金は購入時にシリアルPayが一時お預かりし、取引完了後に出品者の売上へ反映されます。
          購入・出品には LINEログインと本人確認（eKYC）が必要です。
        </p>

        <ol className="space-y-4">
          <li className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3">
            <p className="text-xs font-extrabold tracking-wide text-mint-deep">
              STEP 1
            </p>
            <h3 className="mt-1 font-bold">商品を探す・購入する</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              お探しのシリアルを購入します。お支払い完了後、代金はエスクローとして運営が預かります。
              購入後のキャンセルはできません。
            </p>
          </li>
          <li className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3">
            <p className="text-xs font-extrabold tracking-wide text-mint-deep">
              STEP 2
            </p>
            <h3 className="mt-1 font-bold">コードの開示・確認</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              購入後、取引画面からシリアルを開示して内容を確認します。すぐに使えない場合は、一定期間まで開示を保留できます。
              ただし、期限内に一度も開示しないまま過ぎると、返金なしで取引完了扱いとなり、出品者へ売上が確定します（購入者評価は★1）。
            </p>
          </li>
          <li className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3">
            <p className="text-xs font-extrabold tracking-wide text-mint-deep">
              STEP 3
            </p>
            <h3 className="mt-1 font-bold">受取確認・評価（取引完了）</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              開示後は確認タイマーが始まります。問題なければ「受取確認」のあと評価を行うと取引完了となり、出品者ウォレットへ売上が反映されます。
              期限内に評価がない場合も、自動で取引完了となることがあります。
            </p>
          </li>
          <li className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3">
            <p className="text-xs font-extrabold tracking-wide text-mint-deep">
              もしコードが使えなかったら
            </p>
            <h3 className="mt-1 font-bold">異議申し立て</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              受取確認・評価の前に、取引画面から異議申し立てができます。必要に応じて操作画面の録画などを添付してください。
              運営が確認のうえ、返金や却下などの対応を行います。異議中は確認タイマーが一時停止します。
            </p>
          </li>
        </ol>
      </section>

      <section className="card-surface space-y-4">
        <h2 className="text-xl font-extrabold tracking-tight">よくある質問（FAQ）</h2>

        <div className="space-y-4">
          <details className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3 open:pb-4">
            <summary className="cursor-pointer font-bold">
              購入したシリアルが使用済み・無効だった場合は？
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              受取確認・評価で取引を完了する前に、取引画面から異議申し立てを行ってください。
              「使えたのに使えなかった」などの虚偽申告は禁止です。調査の結果、無効と判断された場合は返金等の対応を行います。
              評価完了後や自動完了後の返金には応じられません。また、開示せずに開示期限を過ぎた場合は返金対象外です。
            </p>
          </details>

          <details className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3">
            <summary className="cursor-pointer font-bold">
              購入後にキャンセルできますか？
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              できません。お支払い完了後の購入者都合キャンセルは受け付けていません。
              コード不備がある場合のみ、異議申し立ての手続きをご利用ください。
            </p>
          </details>

          <details className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3">
            <summary className="cursor-pointer font-bold">
              出品したのに代金が支払われないことはありますか？
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              ありません。購入者が事前に決済（エスクロー預託）した状態で取引が始まるため、未払いの心配はありません。
              取引完了後、販売手数料を差し引いた金額が出品者ウォレットに加算されます。出金時は別途振込手数料がかかります。
            </p>
          </details>

          <details className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3">
            <summary className="cursor-pointer font-bold">
              どのようなシリアルを出品できますか？
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              未使用かつ譲渡可能なシリアルコードのみ出品できます。CD/DVD封入の応募抽選コード、イベント参加申込コード、ノベルティコードなどが対象です。
              使用済み・偽造・存在しないコードや、法令・主催者規約で譲渡・売買が禁止されているものは出品できません。
            </p>
          </details>

          <details className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3">
            <summary className="cursor-pointer font-bold">
              開示を保留したまま放置するとどうなりますか？
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              購入から開示期限（72時間）までに一度も開示しない場合、返金なしで取引完了となり、出品者へ売上が確定します。
              使えないコードだった場合は、期限内に開示したうえで異議申し立てを行ってください。
            </p>
          </details>

          <details className="rounded-2xl border border-ink/10 bg-white/70 px-4 py-3">
            <summary className="cursor-pointer font-bold">
              手数料はいくらですか？
            </summary>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              販売手数料は取引金額の13%です（取引完了時に差引）。出金申請時は振込手数料が一律200円かかります（出金額は500円以上）。
              カード決済には Stripe の決済手数料も別途発生します。
            </p>
          </details>
        </div>
      </section>

      <section className="card-surface space-y-4">
        <h2 className="text-xl font-extrabold tracking-tight">
          取引ルール・禁止事項
        </h2>
        <p className="text-sm leading-relaxed text-ink-soft">
          安全にご利用いただくため、以下を禁止します。発覚した場合、アカウント停止・売上の没収・法的措置などの対応を行うことがあります。
        </p>

        <div className="space-y-3">
          <div>
            <h3 className="font-bold">不正な商品の出品</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-soft">
              <li>使用済み、偽造、または存在しないシリアルの出品</li>
              <li>入手経路が不正（盗難、ハッキング、規約違反など）なコードの出品</li>
              <li>
                転売禁止などに抵触するチケット類や、アカウント自体の譲渡
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold">取引を害する行為</h3>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-soft">
              <li>購入意思のない購入、正当な理由のない異議の乱用</li>
              <li>サイト外での直接取引（直振り、外部SNSへの誘導など）</li>
              <li>
                虚偽の申告（使えたのに「使えなかった」として返金を求めるなど）
              </li>
              <li>開示期限の悪用や、確認・評価の不当な放置</li>
            </ul>
          </div>
          <div>
            <h3 className="font-bold">公式規約・法令の遵守</h3>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              イベント主催者やコンテンツ提供元の利用規約で譲渡・売買が禁じられており、購入者に著しい不利益（アカウント停止や入場拒否など）が生じうるコードの出品は禁止します。
            </p>
          </div>
        </div>
      </section>

      <section className="card-surface space-y-4">
        <h2 className="text-xl font-extrabold tracking-tight">免責事項</h2>
        <div className="space-y-3 text-sm leading-relaxed text-ink-soft">
          <div>
            <h3 className="font-bold text-ink">コンテンツ提供元とのトラブル</h3>
            <p className="mt-1">
              当サービスで取引されたシリアルを使用した結果、主催者や提供元からペナルティ（抽選無効、入場拒否、アカウント凍結など）を受けた場合、当社は責任を負いません。ご利用・ご購入はご自身の判断と責任で行ってください。
            </p>
          </div>
          <div>
            <h3 className="font-bold text-ink">取引完了後のトラブル</h3>
            <p className="mt-1">
              受取確認・評価の完了、または期限による自動完了の時点で、取引は終了したものとみなします。完了後に発覚した不具合やトラブルについて、当社は返金・補償の義務を負いません。
            </p>
          </div>
        </div>
      </section>

      <p className="text-center text-sm text-ink-soft">
        <Link href="/" className="font-semibold text-mint-deep underline">
          トップへ戻る
        </Link>
      </p>
    </main>
  );
}
