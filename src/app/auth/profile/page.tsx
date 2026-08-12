import { Suspense } from "react";
import { ProfileSetupForm } from "@/components/auth/ProfileSetupForm";

export default function ProfileSetupPage() {
  return (
    <main>
      <Suspense fallback={<p className="text-ink-soft">読み込み中…</p>}>
        <ProfileSetupForm />
      </Suspense>
    </main>
  );
}
