// src/pages/Lobby.tsx
import FluidGlassDefs from "../components/FluidGlassDefs";
import { FluidPanel } from "../components/FluidGlass";
import { useBodyClasses } from "../utils/useBodyClasses";
import { useLobbyState } from "../services/useLobbyState";
import ClockCapsuleMobile from "../components/ClockCapsuleMobile";
import LiquidWallpaper from "../components/LiquidWallpaper";

import CashTableCapsule from "../components/CashTableCapsule";
import { useCashTablesFromTables } from "../services/useCashTablesFromTables";
import { useTTD3Tournaments } from "../services/useTTD3Tournaments"; // ⬅️ importa el hook de TTD3

// Estilos
import "../styles/liquid-wallpaper.css";
import "../styles/crystal.css";
import "../styles/ios-stats-pill.css";
import "../styles/ios-stats-pill-embedded.css";
import "../styles/ios-unify-glass-and-clock.css";
import "../styles/cash.css";

export default function Lobby() {
  useBodyClasses(["is-lobby", "lg--liquid"]);
  const { state, fmt } = useLobbyState();

  // ⬇️ Hooks SIEMPRE al tope, sin condicionales
  const tournaments = useTTD3Tournaments();        // TTD3 (Firestore)
  const cashTables  = useCashTablesFromTables();   // tables (Firestore)

  const logoUrl = (import.meta as any).env?.VITE_LOGO_URL || "/logo.svg";
  const title   = state.eventName || state.tournamentName || "Skampa Poker Room";

  const hasTTD3 = Array.isArray(tournaments) && tournaments.length > 0;

  return (
    <div className="page-surface">
      <LiquidWallpaper />

      <div className="container stack" style={{ paddingBottom: 24 }}>
        <FluidGlassDefs />

        {/* Header */}
        <FluidPanel
          className="crystal-panel"
          style={{ padding: 16, display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "center" }}
        >
          <div className="header-logo">
            <img
              src={logoUrl}
              alt="Logo"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
          <h1 className="title" style={{ margin: 0, lineHeight: 1.05 }}>
            {title}
          </h1>
        </FluidPanel>

        {/* ================== TORNEOS ================== */}
        {hasTTD3 ? (
          // Renderizar todos los torneos activos desde TTD3
          <div className="stack" style={{ gap: 12 }}>
            {tournaments.map((t) => {
              const data = {
                entries: t.entries,
                players: t.playersRemaining,
                Rebuy: t.rebuys,
                addons: t.addons,
                pot: t.pot,
                chipCount: t.chips,
                stack: t.avgStack,
                nextBreakSeconds: t.nextBreakSeconds,
                NextbreakText: t.NextbreakText,
                sb: (t as any).smallBlind,
                bb: (t as any).bigBlind,
                ante: (t as any).ante,
                nextSb: (t as any).nextSmallBlind,
                nextBb: (t as any).nextBigBlind,
                nextAnte: (t as any).nextAnte,
                countdownSeconds: (t as any).countdownSeconds ?? (t as any).clockSeconds,
                countdownText: (t as any).countdownText,
              };
              const seconds = (t as any).countdownSeconds ?? (t as any).clockSeconds;
              const round   = (t as any).round ?? (t as any).level;
              const name    = (t as any).name || "Torneo";

              return (
                <ClockCapsuleMobile
                  key={(t as any).id || name}
                  seconds={seconds}
                  round={round}
                  fmt={fmt}
                  data={data}
                />
              );
            })}
          </div>
        ) : (
          // Fallback: usa el "state" local si aún no conectas TTD3
          <ClockCapsuleMobile
            seconds={state.clockSeconds}
            round={state.level}
            fmt={fmt}
            data={{
              entries: state.entries,
              players: state.playersRemaining,
              Rebuy: state.rebuys,
              addons: state.addons,
              pot: state.pot,
              chipCount: (state as any).chipCount ?? (state as any).chips,
              stack: (state as any).stack ?? state.avgStack,
              nextBreakSeconds: state.nextBreakSeconds,
              NextbreakText: state.NextbreakText,
              sb: state.smallBlind,
              bb: state.bigBlind,
              ante: state.ante,
              nextSb: state.nextSmallBlind,
              nextBb: state.nextBigBlind,
              nextAnte: state.nextAnte,
              countdownSeconds: (state as any).countdownSeconds,
              countdownText: (state as any).countdownText,
            }}
          />
        )}

        {/* ================== MESAS DE CASH ================== */}
        {cashTables.length > 0 && (
          <div className="stack" style={{ gap: 12 }}>
            {cashTables.map((ct) => (
              <CashTableCapsule
                key={ct.id || ct.title}
                table={ct}
                fmt={{
                  chips: fmt.chips,
                  money: (n?: number) =>
                    n == null ? "–" : Number(n).toLocaleString("es-MX", { style: "currency", currency: "MXN" }),
                }}
                onViewPlayers={(t) => {
                  // TODO: abre modal o ruta
                  console.log("Ver jugadores:", t);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
