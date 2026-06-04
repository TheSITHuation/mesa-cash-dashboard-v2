// src/components/TimeBar.tsx
import { useEffect, useMemo, useState } from "react";

export default function TimeBar({
  remaining,
  total,
  criticalThreshold = 10,
  roundId,
  mode = "drain", // "drain" = vaciar (por defecto), "fill" = llenar
}: {
  remaining?: number;
  total?: number;
  criticalThreshold?: number;
  roundId?: string | number;
  mode?: "drain" | "fill";
}) {
  // ratio = restante / total  (1 → 0)
  const ratio = useMemo(() => {
    const r = typeof remaining === "number" ? Math.max(0, remaining) : 0;
    const t = typeof total === "number" && total > 0 ? total : (r || 1);
    return Math.max(0, Math.min(1, r / t));
  }, [remaining, total]);

  // pct visible según el modo
  const pct = mode === "drain" ? ratio : 1 - ratio;

  const isCritical = typeof remaining === "number" && remaining <= (criticalThreshold || 0);

  // Flash 1s cuando cambia el nivel
  const [isFlashing, setIsFlashing] = useState(false);
  useEffect(() => {
    if (roundId === undefined || roundId === null) return;
    setIsFlashing(true);
    const id = setTimeout(() => setIsFlashing(false), 1000);
    return () => clearTimeout(id);
  }, [roundId]);

  const cls = [
    "timebar",
    isCritical && "timebar--critical",
    isFlashing && "timebar--flash",
    mode === "drain" && "timebar--drain",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls}>
      <div className="timebar__fill" style={{ transform: `scaleX(${pct})` }} />
    </div>
  );
}
