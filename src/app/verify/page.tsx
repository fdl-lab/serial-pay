import { Suspense } from "react";
import { VerifyClient } from "@/components/auth/VerifyClient";

export default function VerifyPage() {
  return (
    <main>
      <Suspense fallback={<p className="text-ink-soft">読み込み中…</p>}>
        <VerifyClient />
      </Suspense>
    </main>
  );
}
