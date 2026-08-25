"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/auth/fetch";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

const MAX_DURATION_SEC = 180;
const MAX_BYTES = 100 * 1024 * 1024;
const CHUNK_BYTES = 2 * 1024 * 1024;

function readVideoDurationSec(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const duration = video.duration;
      URL.revokeObjectURL(url);
      if (!Number.isFinite(duration) || duration <= 0) {
        reject(new Error("動画の長さを読み取れませんでした"));
        return;
      }
      resolve(duration);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("動画を開けませんでした"));
    };
    video.src = url;
  });
}

async function readJsonSafe(res: Response): Promise<{
  error?: string;
  code?: string;
  [key: string]: unknown;
}> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as { error?: string; code?: string };
  } catch {
    throw new Error(
      `送信に失敗しました（HTTP ${res.status}）。通信環境の良いところで、もう一度お試しください`,
    );
  }
}

function friendlyApiError(json: { error?: string; code?: string }, fallback: string) {
  if (json.error === "Internal Server Error") {
    return "サーバーで処理に失敗しました。時間をおいてもう一度お試しください";
  }
  return json.error ?? fallback;
}

type DisputePageState = {
  canReapply: boolean;
  reviewerNote: string | null;
  disputeStatus: string | null;
};

export default function DisputePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const transactionId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [reason, setReason] = useState("CODE_INVALID");
  const [file, setFile] = useState<File | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [attest, setAttest] = useState(false);
  const [description, setDescription] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [pageState, setPageState] = useState<DisputePageState | null>(null);
  const [abandonBusy, setAbandonBusy] = useState(false);
  const [confirmAbandonOpen, setConfirmAbandonOpen] = useState(false);

  useEffect(() => {
    if (!transactionId) return;
    let cancelled = false;
    (async () => {
      try {
        await apiFetch(`/api/transactions/${transactionId}/dispute/pause`, {
          method: "POST",
        });
      } catch {
        // 停止失敗でも申請UIは出す（送信時に再チェック）
      }
      try {
        const res = await apiFetch(`/api/transactions/${transactionId}/dispute`);
        const json = await readJsonSafe(res);
        if (!cancelled && res.ok) {
          setPageState({
            canReapply: Boolean(json.canReapply),
            reviewerNote: (json.reviewerNote as string | null) ?? null,
            disputeStatus: (json.disputeStatus as string | null) ?? null,
          });
        }
      } catch {
        // 状態取得失敗でも申請は試せる
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transactionId]);

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
          setErr(e instanceof Error ? e.message : "動画の確認に失敗しました");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  async function uploadRecording(file: File, durationSec: number) {
    setProgress("アップロード準備中…");
    const initRes = await apiFetch(
      `/api/transactions/${transactionId}/dispute/upload-init`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          contentType: file.type || "video/mp4",
          size: file.size,
          durationSec: Math.round(durationSec),
        }),
      },
    );
    const initJson = await readJsonSafe(initRes);
    if (!initRes.ok) {
      throw new Error(friendlyApiError(initJson, "アップロード準備に失敗しました"));
    }

    const key = String(initJson.key);
    const uploadId = String(initJson.uploadId);
    const mode = initJson.mode === "local" ? "local" : "s3";
    const chunkBytes =
      typeof initJson.chunkBytes === "number"
        ? initJson.chunkBytes
        : CHUNK_BYTES;
    const totalParts = Math.max(1, Math.ceil(file.size / chunkBytes));
    const parts: { partNumber: number; etag: string }[] = [];

    for (let i = 0; i < totalParts; i += 1) {
      const partNumber = i + 1;
      const start = i * chunkBytes;
      const end = Math.min(file.size, start + chunkBytes);
      const blob = file.slice(start, end);

      setProgress(`動画を送信中…（${partNumber}/${totalParts}）`);

      const form = new FormData();
      form.append("key", key);
      form.append("uploadId", uploadId);
      form.append("mode", mode);
      form.append("partNumber", String(partNumber));
      form.append("chunk", blob, `part-${partNumber}`);

      const partRes = await apiFetch(
        `/api/transactions/${transactionId}/dispute/upload-part`,
        { method: "POST", body: form },
      );
      const partJson = await readJsonSafe(partRes);
      if (!partRes.ok || typeof partJson.etag !== "string") {
        throw new Error(
          friendlyApiError(partJson, "動画の送信に失敗しました"),
        );
      }
      parts.push({ partNumber, etag: partJson.etag });
    }

    setProgress("アップロードを確定中…");
    const doneRes = await apiFetch(
      `/api/transactions/${transactionId}/dispute/upload-complete`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          uploadId,
          mode,
          parts,
          contentType: file.type || "video/mp4",
        }),
      },
    );
    const doneJson = await readJsonSafe(doneRes);
    if (!doneRes.ok) {
      throw new Error(
        friendlyApiError(doneJson, "アップロード確定に失敗しました"),
      );
    }

    return {
      url: String(doneJson.url),
      key: String(doneJson.key),
      recordingDurationSec: Math.round(durationSec),
    };
  }

  async function runAbandon() {
    setAbandonBusy(true);
    setErr(null);
    try {
      const res = await apiFetch(
        `/api/transactions/${transactionId}/dispute/abandon`,
        { method: "POST" },
      );
      const json = await readJsonSafe(res);
      if (!res.ok) throw new Error(friendlyApiError(json, "終了に失敗しました"));
      const redirectTo =
        typeof json.redirectTo === "string"
          ? json.redirectTo
          : `/transactions/${transactionId}`;
      router.push(redirectTo);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラーが発生しました");
      setAbandonBusy(false);
      setConfirmAbandonOpen(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    setProgress(null);
    try {
      if (!transactionId) throw new Error("取引IDが不正です");
      if (!file) throw new Error("画面録画を添付してください");
      if (!attest) {
        throw new Error("切り取りルールへの同意が必要です");
      }
      if (file.size > MAX_BYTES) {
        throw new Error(
          "動画は100MB以内にしてください（必要箇所を3分以内に切り取り）",
        );
      }
      if (durationSec == null) {
        throw new Error(
          "動画の長さを確認できませんでした。別のファイルをお試しください",
        );
      }
      if (durationSec > MAX_DURATION_SEC) {
        throw new Error(
          "必要箇所を3分以内に切り取ってからアップロードしてください（編集・AI加工は不可）",
        );
      }

      const uploaded = await uploadRecording(file, durationSec);

      setProgress("申請を送信中…");
      const res = await apiFetch(`/api/transactions/${transactionId}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          description,
          screenRecordingUrl: uploaded.url,
          screenRecordingKey: uploaded.key,
          recordingDurationSec: uploaded.recordingDurationSec,
          attestUnedited: true,
        }),
      });
      const json = await readJsonSafe(res);
      if (!res.ok) throw new Error(friendlyApiError(json, "申請に失敗しました"));
      setMsg(
        `異議を受け付けました（${json.disputeId}）。事務局確認後、許可されれば1〜2週間でウォレットへ返金されます。結果はマイページのメッセージでお知らせします。`,
      );
      setFile(null);
      setDurationSec(null);
      setAttest(false);
      setProgress(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "エラーが発生しました";
      setErr(message);
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  const durationLabel =
    durationSec == null
      ? null
      : `${Math.floor(durationSec / 60)}:${String(Math.floor(durationSec % 60)).padStart(2, "0")}`;

  const isReapply =
    Boolean(pageState?.canReapply) || pageState?.disputeStatus === "REJECTED";

  return (
    <main>
      <nav className="nav">
        <a href={`/transactions/${transactionId}`}>← 開示画面</a>
      </nav>

      {isReapply && !msg && (
        <section className="card-surface mb-4 space-y-3">
          <p className="font-bold text-amber-950">前回の異議は却下されました</p>
          <p className="text-sm text-ink-soft">
            不足分を追記して再申請するか、申請せずに開示前の状態へ戻せます（再開示で確認タイマーが新たに始まります）。
          </p>
          {pageState?.reviewerNote && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-ink-soft">
              事務局メモ: {pageState.reviewerNote}
            </p>
          )}
          <button
            type="button"
            className="btn btn-primary btn-block min-h-12"
            disabled={abandonBusy || busy}
            onClick={() => setConfirmAbandonOpen(true)}
          >
            申請せずに終了する
          </button>
        </section>
      )}

      <form className="card-surface" onSubmit={submit} noValidate>
        <p className="brand-mark">シリアルPay</p>
        <h1 className="text-3xl font-extrabold tracking-tight">
          {isReapply ? "異議の再申請" : "異議申し立て"}
        </h1>
        <p className="mb-3 mt-2 text-ink-soft">
          コード表示前からエラー画面までの画面録画の添付が必須です。未添付の申請は受け付けられません。
        </p>

        <div className="mb-4 rounded-2xl border border-mint/40 bg-mint/10 p-4 text-sm leading-relaxed">
          <p className="font-bold text-mint-deep">返金について</p>
          <p className="mt-2 text-ink-soft">
            事務局確認のうえ許可された場合、
            <strong className="text-ink">確認後およそ1〜2週間</strong>
            でウォレット残高へ返金されます。審査結果はマイページのメッセージでお知らせします。
          </p>
        </div>

        <div className="mb-4 rounded-2xl border border-coral/30 bg-coral/5 p-4 text-sm leading-relaxed">
          <p className="font-bold text-coral">容量・提出ルール</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-soft">
            <li>
              <strong className="text-ink">必要箇所だけを3分以内</strong>
              に切り取ってアップロードしてください
            </li>
            <li>
              <strong className="text-ink">編集動画・AI加工は不可</strong>
              （カット以外の加工は却下）
            </li>
            <li>対応形式: MP4 / MOV / WebM · 100MB以内</li>
            <li>
              送信には時間がかかることがあります。完了まで画面を閉じないでください
            </li>
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
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/*"
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
                  （3分を超えています）
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

        {progress && <p className="banner-ok">{progress}</p>}
        {err && <p className="banner-error">{err}</p>}
        {msg && <p className="banner-ok">{msg}</p>}

        <button
          className="btn btn-primary btn-block"
          type="submit"
          disabled={busy || !!msg}
        >
          {busy
            ? progress || "送信中…"
            : isReapply
              ? "再申請する"
              : "審査を申請する"}
        </button>

        {isReapply && !msg && (
          <button
            type="button"
            className="btn btn-ghost btn-block mt-2 min-h-12"
            disabled={abandonBusy || busy}
            onClick={() => setConfirmAbandonOpen(true)}
          >
            申請せずに終了する
          </button>
        )}
      </form>

      <ConfirmModal
        open={confirmAbandonOpen}
        title="本当に終了しますか？"
        body={
          "再申請は行わず、開示前の状態に戻ります。\nもう一度開示すると確認タイマー（60分）が新たに始まります。\n開示期限は終了した時点から72時間になります。"
        }
        confirmLabel="終了する"
        cancelLabel="キャンセル"
        busy={abandonBusy}
        onCancel={() => {
          if (!abandonBusy) setConfirmAbandonOpen(false);
        }}
        onConfirm={() => void runAbandon()}
      />
    </main>
  );
}
