"use client";

type Props = {
  open: boolean;
  windowMinutes: number;
  onAccept: () => void;
};

export function RecordingWarningModal({ open, windowMinutes, onAccept }: Props) {
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
        <p className="text-sm font-extrabold text-coral">必ず読んでね</p>
        <h2 id="rec-title" className="mt-1 text-xl font-bold tracking-tight">
          コード表示前に画面録画を開始して
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          「使えなかった」として異議申し立てする場合、
          <strong className="text-ink">コード表示前〜公式サイトでの入力・エラー画面まで</strong>
          を記録した画面録画の提出が必須だよ。録画なしの申請は自動却下になる。
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-relaxed">
          <li>端末の画面録画を ON にしてから「コードを表示」を押す</li>
          <li>開示後 {windowMinutes} 分以内に応募・受取確認 or 異議申し立て</li>
          <li>期限内に何もしないと自動で取引完了・ウォレットへ売上確定</li>
        </ul>
        <button type="button" className="btn btn-primary btn-block mt-5" onClick={onAccept}>
          録画を開始したのでコードを表示する
        </button>
      </div>
    </div>
  );
}
