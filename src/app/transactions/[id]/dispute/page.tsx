"use client";

import { useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/auth/fetch";

export default function DisputePage() {
  const params = useParams<{ id: string }>();
  const [reason, setReason] = useState("CODE_INVALID");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (!url.trim()) {
        throw new Error("画面録画がない申請は自動却下です。URLを添付してね。");
      }
      const res = await apiFetch(`/api/transactions/${params.id}/dispute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          description,
          screenRecordingUrl: url,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "申請に失敗しました");
      setMsg(`異議を受け付けたよ（${json.disputeId}）。運営審査をお待ちください。`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "エラー");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main>
      <nav className="nav">
        <a href={`/transactions/${params.id}`}>← 開示画面</a>
      </nav>
      <form className="card-surface" onSubmit={submit}>
        <p className="brand-mark">シリアルPay</p>
        <h1 className="text-3xl font-extrabold tracking-tight">異議申し立て</h1>
        <p className="mb-4 mt-2 text-ink-soft">
          コード表示前からエラー画面までの画面録画が必須。未添付は受け付けないよ。
        </p>

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
          <span>画面録画 URL（必須）</span>
          <input
            required
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
          />
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

        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? "送信中…" : "審査を申請する"}
        </button>
      </form>
    </main>
  );
}
