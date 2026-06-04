// src/components/CashTableCapsule.tsx
import "../styles/cash.css";

export type CashStatus = "activa" | "en espera" | "inactiva";
export type CashGame = "NLHE" | "PLO" | "DCH" | "MAA";

export type CashTable = {
  id?: string;
  title: string;
  game: CashGame;
  sb?: number; bb?: number;            // blinds
  buyinMin?: number; buyinMax?: number;
  players?: number; maxPlayers?: number;
  waiting?: number;                     // personas en espera
  status?: CashStatus;
  whatsapp?: string;                    // e.g., 5219991234567
  playersUrl?: string;                  // opcional: ver jugadores
};

export default function CashTableCapsule({
  table,
  onViewPlayers,
  fmt,
}: {
  table: CashTable;
  onViewPlayers?: (t: CashTable) => void;
  fmt?: { chips?: (n?: number)=>string; money?: (n?: number)=>string };
}) {
  const t = table;

  const money = (n?: number) =>
    n == null ? "–" : (fmt?.money ? fmt.money(n) :
    Number(n).toLocaleString("es-MX", { style:"currency", currency:"MXN" }));

  const chips = (n?: number) =>
    n == null ? "–" : (fmt?.chips ? fmt.chips(n) :
    Number(n).toLocaleString("es-MX"));

  // ---- Status / Badge -------------------------------------------------------
  const status = (t.status || "inactiva") as CashStatus;

  // "ABRIENDO": no activa, hay lista de espera (>0) y aún 0 jugadores sentados
  const opening = status !== "activa" && (t.waiting ?? 0) > 0 && (t.players ?? 0) === 0;

  const stCls =
    opening ? "status--opening" :
    status === "activa" ? "status--active" :
    status === "en espera" ? "status--waiting" :
    "status--inactive";

  const badgeLabel =
    opening ? "ABRIENDO" :
    status === "activa" ? "ACTIVA" :
    status === "en espera" ? "EN ESPERA" :
    "INACTIVA";

  // ---- Datos mostrados ------------------------------------------------------
  const blinds  = `${chips(t.sb)} / ${chips(t.bb)}`;
  const buyin   = `${money(t.buyinMin)} - ${money(t.buyinMax)}`;
  const players = `${t.players ?? 0} / ${t.maxPlayers ?? 9}`;
  const wait    = `${t.waiting ?? 0} persona${(t.waiting ?? 0) === 1 ? "" : "s"}`;

  // WhatsApp link (fallback a VITE_WHATSAPP_DEFAULT)
  const to = (t.whatsapp || (import.meta as any).env?.VITE_WHATSAPP_DEFAULT || "")
    .toString().replace(/[^0-9]/g, "");
  const message = encodeURIComponent(
    `Hola! Quiero anotarme a la mesa "${t.title}" (${t.game}) blind ${blinds}.`
  );
  const wapp = to ? `https://wa.me/${to}?text=${message}` : undefined;

  return (
    <div className="ios-widget cash-cap">
      {/* Header */}
      <div className="cash-head">
        <div className="cash-title">{t.title}</div>
        <div className={["status-badge", stCls].join(" ")}>
          <span className="status-dot" />
          <span>{badgeLabel}</span>
        </div>
      </div>

      {/* Details grid (2 cols) */}
      <div className="cash-grid">
        <div className="cash-pill">
          <div className="pill-label">Juego</div>
          <div className="pill-value">{t.game}</div>
        </div>
        <div className="cash-pill">
          <div className="pill-label">Blinds</div>
          <div className="pill-value">{blinds}</div>
        </div>
        <div className="cash-pill">
          <div className="pill-label">Buy In</div>
          <div className="pill-value">{buyin}</div>
        </div>
        <div className="cash-pill">
          <div className="pill-label">Players</div>
          <div className="pill-value">{players}</div>
        </div>
        <div className="cash-pill">
          <div className="pill-label">En espera</div>
          <div className="pill-value">{wait}</div>
        </div>
        {/* Relleno visual para mantener el ritmo 2×N */}
        <div className="cash-pill" style={{ opacity: 0, borderStyle: "dashed" }} aria-hidden="true">
          <div className="pill-label"> </div>
          <div className="pill-value"> </div>
        </div>
      </div>

      {/* Actions */}
      <div className="cash-actions">
        {t.playersUrl ? (
          <a className="ios-btn secondary" href={t.playersUrl} target="_blank" rel="noopener noreferrer">
            Ver jugadores
          </a>
        ) : (
          <button className="ios-btn secondary" onClick={() => onViewPlayers?.(t)} type="button">
            Ver jugadores
          </button>
        )}

        {wapp ? (
          <a className="ios-btn whats" href={wapp} target="_blank" rel="noopener noreferrer">
            Anotarme (WhatsApp)
          </a>
        ) : (
          <a className="ios-btn whats" href="#" aria-disabled="true" onClick={(e) => e.preventDefault()}>
            Anotarme
          </a>
        )}
      </div>
    </div>
  );
}
