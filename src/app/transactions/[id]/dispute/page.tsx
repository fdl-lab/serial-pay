"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/auth/fetch";

const MAX_DURATION_SEC = 180;
const MAX_BYTES = 100 * 1024 * 1024;

function readVideoDurationSec(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(url);
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("動画の長さを読み取れなかったよ"));
        return;
      }
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("動画を開けなかったよ"));
    };
    video.src = url;
  });
}

export default function DisputePage() {
  const params = useParams<{ id: string }>();
  const [reason, setReason] = useState("CODE_INVALID");
  const [file, setFile] = useState<File | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [attest, setAttest] = useState(false);
  const [description, setDescription] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) {
      setDurationSec(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const sec = await readVideoDurationSec(file);
        if (!cancelled) setDurationSec(sec);
      } catch (e) {
        if (!cancelled) {
          setDurationSec(null);
          setErr(e instanceof Error ? e.message : "動画の確認に失敗");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (!file) throw new Error("画面録画を添付してね");
      if (!attest) {
        throw new Error("切り取りルールへの同意が必要だよ");
      }
      if (file.size > MAX_BYTES) {
        throw new Error("動画は100MB以内にしてね（必要箇所を3分以内に切り取り）");
      }
      if (durationSec == null) {
        throw new Error("動画の長さを確認できなかったよ。別のファイルを試してね");
      }
      if (durationSec > MAX_DURATION_SEC) {
        throw new Error(
          "必要箇所を3分以内に切り取ってからアップしてね（編集・AI加工は不可）",
        );
      }

      const form = new FormData();
      form.append("file", file);
      form.append("durationSec", String(Math.round(durationSec)));

      const up = await apiFetch(`/api/transactions/${params.id}/dispute/upload`, {
        method: "POST",
        body: form,
      });
      const upJson = await up.json();
      if (!up.ok) throw new Error(upJson.error ?? "アップロードに失敗しました");

      const res = await apiFetch(`/api/transactions/${params.id}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          description,
          screenRecordingUrl: upJson.url,
          screenRecordingKey: upJson.key,
          recordingDurationSec: upJson.recordingDurationSec,
          attestUnedited: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "申請に失敗しました");
      setMsg(
        `異議を受け付けたよ（${json.disputeId}）。事務局確認後、許可されれば1〜2週間でウォレットへ返金されるよ。結果はマイページのメッセージで届くね。`,
      );
      setFile(null);
      setDurationSec(null);
      setAttest(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  const durationLabel =
    durationSec == null
      ? null
      : `${Math.floor(durationSec / 60)}:${String(Math.floor(durationSec % 60)).padStart(2, "0")}`;

  return (
    <main>
      <nav className="nav">
        <a href={`/transactions/${params.id}`}>← 開示画面</a>
      </nav>
      <form className="card-surface" onSubmit={submit}>
        <p className="brand-mark">シリアルPay</p>
        <h1 className="text-3xl font-extrabold tracking-tight">異議申し立て</h1>
        <p className="mb-3 mt-2 text-ink-soft">
          コード表示前からエラー画面までの画面録画の添付が必須。未添付は受け付けないよ。
        </p>

        <div className="mb-4 rounded-2xl border border-mint/40 bg-mint/10 p-4 text-sm leading-relaxed">
          <p className="font-bold text-mint-deep">返金について</p>
          <p className="mt-2 text-ink-soft">
            事務局確認のうえ許可された場合、
            <strong className="text-ink">確認後およそ1〜2週間</strong>
            でウォレット残高へ返金されます。審査結果はマイページのメッセージでお知らせするよ。
          </p>
        </div>

        <div className="mb-4 rounded-2xl border border-coral/30 bg-coral/5 p-4 text-sm leading-relaxed">
          <p className="font-bold text-coral">容量・提出ルール</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
            <li>
              <strong className="text-ink">必要箇所だけを3分以内</strong>
              に切り取ってアップしてね
            </li>
            <li>
              <strong className="text-ink">編集動画・AI加工は不可</strong>
              （カット以外の加工は却下）
            </li>
            <li>対応形式: MP4 / MOV / WebM · 100MB以内</li>
          </ul>
        </div>

        <label className="field">
          <span>理由</span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            style={{
              width: "100%",
              padding: "0.85rem",
              borderRadius: 12,
              border: "1px solid rgba(18,21,28,0.12)",
              font: "inherit",
            }}
          >
            <option value="CODE_INVALID">コードが無効・エラー</option>
            <option value="CODE_ALREADY_USED">既に使用済み</option>
            <option value="WRONG_CODE">別イベント等の誤コード</option>
            <option value="OTHER">その他</option>
          </select>
        </label>

        <label className="field">
          <span>画面録画（添付・必須）</span>
          <input
            required
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm"
            onChange={(e) => {
              setErr(null);
              setFile(e.target.files?.[0] ?? null);
            }}
          />
          {file && (
            <p className="mt-2 text-xs text-ink-soft">
              {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
              {durationLabel ? ` · ${durationLabel}` : " · 長さ確認中…"}
              {durationSec != null && durationSec > MAX_DURATION_SEC && (
                <span className="ml-1 font-semibold text-coral">
                  （3分超えてるよ）
                </span>
              )}
            </p>
          )}
        </label>

        <label className="mt-2 flex items-start gap-2 text-sm leading-relaxed">
          <input
            type="checkbox"
            className="mt-1"
            checked={attest}
            onChange={(e) => setAttest(e.target.checked)}
            required
          />
          <span>
            必要箇所を3分以内に切り取り、編集動画・AI加工をしていないことを確認した
          </span>
        </label>

        <label className="field">
          <span>補足</span>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>

        {err && <p className="banner-error">{err}</p>}
        {msg && <p className="banner-ok">{msg}</p>}

        <button className="btn btn-primary btn-block" type="submit" disabled={busy || !!msg}>
          {busy ? "アップロード＆送信中…" : "審査を申請する"}
        </button>
      </form>
    </main>
  );
}
