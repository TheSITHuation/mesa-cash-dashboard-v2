// src/components/CircleTimer.tsx
export default function CircleTimer({
  seconds,
  countdownSeconds,
  labelTop,
  labelBottom = "Tiempo restante",
  dangerThreshold = 10,          // parpadeo <=10s
  dangerUrgentThreshold = 5,     // parpadeo más rápido <=5s
}: {
  seconds?: number;
  countdownSeconds?: number;
  labelTop?: string;
  labelBottom?: string;
  dangerThreshold?: number;
  dangerUrgentThreshold?: number;
}) {
  const src = (countdownSeconds ?? seconds ?? 0) as number;
  const total = Math.max(0, Number(src));
  const hh = Math.floor(total / 3600).toString().padStart(2, "0");
  const mm = Math.floor((total % 3600) / 60).toString().padStart(2, "0");
  const ss = Math.floor(total % 60).toString().padStart(2, "0");
  const showHours = Math.floor(total / 3600) > 0;
  const out = showHours ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;

  const isDanger = total > 0 && total <= dangerThreshold;
  const isUrgent = total > 0 && total <= dangerUrgentThreshold;

  return (
    <div className={`clock ${isUrgent ? "clock--danger-urgent" : isDanger ? "clock--danger" : ""}`} style={{display:"grid", justifyItems:"center", gap:6, width:"100%"}}>
      {labelTop && (
        <div style={{fontWeight:900, fontSize:"clamp(12px, 4vw, 24px)"}}>{labelTop}</div>
      )}
      <div
        className="clock-time"
        style={{
          fontSize: "clamp(44px, 18vw, 160px)",
          lineHeight: 1,
          fontWeight: 1000,
          letterSpacing: "2px",
          textAlign: "center",
          width: "100%",
        }}
      >
        {out}
      </div>
      {labelBottom && (
        <div style={{opacity:.85, fontSize:"clamp(11px, 3.2vw, 16px)"}}>{labelBottom}</div>
      )}
    </div>
  );
}
