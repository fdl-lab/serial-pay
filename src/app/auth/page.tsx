import { Suspense } from "react";
import { LineAuthForm } from "@/components/auth/LineAuthForm";

export default function AuthPage() {
  return (
    <main>
      <Suspense fallback={<p className="text-ink-soft">読み込み中…</p>}>
        <LineAuthForm />
      </Suspense>
    </main>
  );
}
