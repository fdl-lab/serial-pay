"use client";

type Props = {
  open: boolean;
  windowMinutes: number;
  onAccept: () => void;
  onDefer: () => void;
};

export function RecordingWarningModal({
  open,
  windowMinutes,
  onAccept,
  onDefer,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rec-title"
    >
      <div className="absolute inset-0 bg-ink/55 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-2xl border border-ink/10 bg-paper p-5 shadow-xl">
        <p className="text-sm font-extrabold text-coral">必ずお読みください</p>
        <h2 id="rec-title" className="mt-1 text-xl font-bold tracking-tight">
          コード表示前に画面録画を開始してください
        </h2>
        <p className="mt-3 rounded-xl bg-mint/15 px-3 py-2 text-sm font-semibold leading-relaxed text-mint-deep">
          確認タイマー（{windowMinutes}分）は、下の「コードを表示する」を押した瞬間から始まります。
          この注釈を読んでいるあいだはまだ始まりませんので、ご安心ください。
          購入後のキャンセルはできません。開示前の保留は購入から72時間まで（過ぎると返金なしで取引完了、評価★1）。
        </p>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          「使えなかった」として異議申し立てする場合、
          <strong className="text-ink">コード表示前〜公式サイトでの入力・エラー画面まで</strong>
          を記録した画面録画の提出が必須です。録画なしの申請は自動却下になります。
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed">
          <li>端末の画面録画を ON にしてから「コードを表示」を押してください</li>
          <li>
            コード表示後 {windowMinutes}{" "}
            分以内に、受取確認と評価（評価で取引完了）、または異議申し立てを行ってください
          </li>
          <li>期限内に評価がない場合、自動で取引完了となりウォレットへ売上が確定します</li>
          <li>異議時は必要箇所を3分以内に切り取り添付してください（編集・AI加工は不可）</li>
          <li>
            準備ができていない場合は「保留」し、マイページからいつでも開示できます
          </li>
        </ul>
        <div className="mt-5 flex flex-col gap-2">
          <button type="button" className="btn btn-primary btn-block" onClick={onAccept}>
            録画を開始したのでコードを表示する
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={onDefer}>
            まだシリアルは見ないで保留する
          </button>
        </div>
      </div>
    </div>
  );
}
