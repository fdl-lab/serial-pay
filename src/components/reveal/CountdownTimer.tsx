"use client";

import { useEffect, useState } from "react";

type Props = {
  deadlineIso: string | null;
  onExpire?: () => void;
};

export function CountdownTimer({ deadlineIso, onExpire }: Props) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    if (!deadlineIso) return;
    const deadline = new Date(deadlineIso).getTime();
    let expiredFired = false;

    const tick = () => {
      const left = deadline - Date.now();
      setRemainingMs(Math.max(0, left));
      if (left <= 0 && !expiredFired) {
        expiredFired = true;
        onExpire?.();
      }
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [deadlineIso, onExpire]);

  if (remainingMs === null) {
    return <span className="font-mono text-3xl font-semibold">--:--</span>;
  }

  const totalSec = Math.ceil(remainingMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const urgent = totalSec <= 5 * 60;

  return (
    <span
      className={`font-mono text-3xl font-semibold tracking-wide ${
        urgent ? "animate-pulse text-coral" : "text-ink"
      }`}
      aria-live="polite"
    >
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}
