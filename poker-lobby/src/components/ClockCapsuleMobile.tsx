// src/components/ClockCapsuleMobile.tsx
import { useEffect, useState } from "react";            // ⬅️ nuevo
import CircleTimer from "./CircleTimer";
import { FluidPill } from "./FluidGlass";
import TimeBar from "./TimeBar";                        // ⬅️ nuevo
import "../styles/timebar.css";                         // ⬅️ nuevo (estilos de la barra)

type Props = {
  seconds?: number;
  round?: number | string;
  fmt: { chips: (n?: number)=>string; time: (s?: number)=>string };
  data: {
    entries?: number; players?: number; Rebuy?: number; addons?: number;
    pot?: number; chipCount?: number; stack?: number;
    nextBreakSeconds?: number; NextbreakText?: string;
    countdownSeconds?: number; countdownText?: string;
    sb?: number; bb?: number; ante?: number;
    nextSb?: number; nextBb?: number; nextAnte?: number;
  };
};

export default function ClockCapsuleMobile({ seconds, round, fmt, data }: Props){
  const {
    entries, players, Rebuy, addons, pot, chipCount, stack,
    nextBreakSeconds, NextbreakText,
    countdownSeconds, countdownText,
    sb, bb, ante, nextSb, nextBb, nextAnte
  } = data;

  const num = (n?: number) => n == null ? "–" : n.toLocaleString("es-MX", { maximumFractionDigits: 0 });
  const money = (n?: number) => n == null ? "–" : n.toLocaleString("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
  const textToSec = (t?: string) => {
    if (!t) return undefined;
    const m = String(t).trim().split(":").map(Number);
    if (m.some((x) => Number.isNaN(x))) return undefined;
    if (m.length === 3) return m[0]*3600 + m[1]*60 + m[2];
    if (m.length === 2) return m[0]*60 + m[1];
    return undefined;
  };

  // segundos que muestra el reloj (countdown si existe; si no, clock)
  const cdSec = countdownSeconds ?? textToSec(countdownText);
  const clockSec = (cdSec ?? seconds) as number | undefined;

  // ⬇️ total del nivel: si no viene, "aprendemos" el mayor valor visto
  const [maxSeen, setMaxSeen] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (typeof clockSec === "number") {
      setMaxSeen((m) => (m == null || clockSec > m ? clockSec : m));
    }
  }, [clockSec]);
  const totalSec = cdSec ?? maxSeen;

  const breakStr = nextBreakSeconds != null ? fmt.time(nextBreakSeconds) : (NextbreakText ?? "–");

  const roundStr = String(round ?? "");
  const isBreak = /break|descanso|pausa/i.test(roundStr) || (!sb && !bb);
  const isFinalTable =
    /final/i.test(roundStr) || /mesa\s*final/i.test(roundStr) || (typeof players === "number" && players <= 9);
  const bannerTint = isFinalTable ? "final" : isBreak ? "break" : "level";

  return (
    <div className="ios-widget mobile-capsule" style={{ padding: 16, display: "grid", gap: 16 }}>
      {/* Banner */}
      <div className={`ios-banner ${bannerTint}`}>
        <div className="ios-banner-dot" />
        <div className="label">
          {bannerTint === "final" ? "FINAL TABLE" : bannerTint === "break" ? "BREAK" : "LEVEL"} {String(round)}
        </div>
      </div>

      {/* ⬇️ Barra de tiempo: va EXACTAMENTE aquí, debajo del banner */}
      <TimeBar
        key={`round-${String(round ?? "")}`}     // fuerza reset al cambiar de nivel
        remaining={clockSec}
        total={totalSec}
        roundId={round}                          // activa el “flash” 1s al cambiar de nivel
        mode="drain"
        // criticalThreshold={10}                // opcional: umbral de estado crítico
      />

      {/* Reloj principal */}
      <CircleTimer seconds={clockSec} labelTop={undefined} labelBottom="Tiempo restante" />

      {/* Pills de blinds */}
      <div style={{display:"grid", gap:10, gridTemplateColumns:"1fr 1fr"}}>
        <FluidPill className="ios-pill" style={{justifyContent:"center"}}>
          Blinds {fmt.chips(sb)} / {fmt.chips(bb)} • Ante {fmt.chips(ante)}
        </FluidPill>
        <FluidPill className="ios-pill" style={{justifyContent:"center"}}>
          Siguiente {fmt.chips(nextSb)} / {fmt.chips(nextBb)} • Ante {fmt.chips(nextAnte)}
        </FluidPill>
      </div>

      {/* Stats en 2 columnas con pill interna */}
      <div className="stats-grid stats-grid--2col" style={{display:"grid", gap:12, alignItems:"start"}}>
        <StatItem label="Entradas"  value={num(entries)} />
        <StatItem label="Jugadores" value={num(players)} />
        <StatItem label="Recompras" value={num(Rebuy)} />
        <StatItem label="Addons"    value={num(addons)} />
        <StatItem label="Fichas"    value={num(chipCount)} />
        <StatItem label="AVG"       value={fmt.chips(stack)} />
        <StatItem label="Acumulado" value={money(pot)} />
        <StatItem label="Break en"  value={breakStr} />
      </div>
    </div>
  );
}

function StatItem({ label, value }:{ label:string; value?:string }){
  return (
    <div style={{display:"grid", gap:6, justifyItems:"stretch", width:"100%"}}>
      <div className="ios-pill ios-pill--stat">
        <div className="pill-label">{label}</div>
        <div className="pill-value">{value ?? "–"}</div>
      </div>
    </div>
  );
}
