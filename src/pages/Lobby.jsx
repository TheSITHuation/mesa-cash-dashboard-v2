// src/pages/Lobby.jsx
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useAuthAnon from '../hooks/useAuthAnon.js';
import useTd3 from '../hooks/useTd3.js';
import useTournamentList from '../hooks/useTournamentList.js';
import useTables from '../hooks/useTables.js';
import usePromotions from '../hooks/usePromotions.js';
import { PromoBanner } from '../components/promo-banner/PromoBanner.jsx';
import StartOverlay from '../components/StartOverlay.jsx';
import { CASINO_PHONE } from '../config/constants.js';
import CollapsibleSection, { StatusPill } from '../components/ui/CollapsibleSection.jsx';
import { LayoutGrid, Armchair, Users, ChevronRight } from 'lucide-react';
import '../components/ui/CollapsibleSection.css';
import './Lobby.scss';
import '../components/ui/TabSwitcher.css';

  // Tipos de juego disponibles
  const GAME_TYPES = ['NLHE', 'PLO', 'MAA', 'DCH', 'V&V'];


// ─── helpers ────────────────────────────────────────────────────
const fmtInt = (n) => Number(n || 0).toLocaleString('es-MX');
const fmtMXN = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n || 0);
const statusRank = (st) => {
  const v = String(st || '').toLowerCase();
  if (v === 'active' || v === 'activa') return 0;
  if (v === 'en-espera' || v === 'en espera') return 1;
  return 2;
};

const td3Fmt = (s) => {
  s = Math.max(0, Math.floor(Number(s) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const statusConfig = (st) => {
  const v = String(st || '').toLowerCase();
  if (v === 'active' || v === 'activa') return { label: 'Activa', color: '#30d158', bg: 'rgba(48,209,88,.15)', dot: '#30d158', pulse: true };
  if (v === 'en-espera' || v === 'en espera') return { label: 'En espera', color: '#ffd60a', bg: 'rgba(255,214,10,.15)', dot: '#ffd60a', pulse: true };
  return { label: 'Inactiva', color: '#636366', bg: 'rgba(99,99,102,.15)', dot: '#636366', pulse: false };
};

const tourneyStatusConfig = (td3) => {
  if (td3?.isPaused) return { label: 'Pausado', color: '#ffd60a', bg: 'rgba(255,214,10,.15)', dot: '#ffd60a', pulse: false };
  if (td3?.isBreak) return { label: 'Descanso', color: '#0a84ff', bg: 'rgba(10,132,255,.15)', dot: '#0a84ff', pulse: false };
  if (!td3?.isBreak && !td3?.preStart && (td3?.round > 0 || (td3?.seconds || 0) > 0)) {
    return { label: 'En Vivo', color: '#30d158', bg: 'rgba(48,209,88,.15)', dot: '#30d158', pulse: true };
  }
  return { label: 'Inactivo', color: '#636366', bg: 'rgba(99,99,102,.15)', dot: '#636366', pulse: false };
};

const buildWhatsAppUrl = (t) => {
  const phone = CASINO_PHONE.replace(/[^\d]/g, '');
  if (!phone) return null;
  const msg =
    `Hola, quiero anotarme a la mesa "${t?.name || 'Mesa'}" ` +
    `(${t?.game || 'NLHE'} ${t?.sb ?? 0}/${t?.bb ?? 0}).\n` +
    `Buy-in: ${t?.minBuyFmt} – ${t?.maxBuyFmt}.\nMi nombre es: `;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
};

const buildTourneyWhatsAppUrl = (t) => {
  const phone = CASINO_PHONE.replace(/[^\d]/g, '');
  if (!phone) return null;
  const msg = `Hola, me interesa obtener información e inscribirme al torneo "${t?.tournamentName || 'Torneo'}".\nMi nombre es: `;
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
};

const gameColor = (g) => {
  const type = String(g || '').toUpperCase();
  if (type === 'NLHE') return { label: '#30d158', bg: 'rgba(48,209,88,.12)', border: '#30d158' };
  if (type === 'PLO') return { label: '#0a84ff', bg: 'rgba(10,132,255,.12)', border: '#0a84ff' };
  if (type === 'MAA') return { label: '#bf5af2', bg: 'rgba(191,90,242,.12)', border: '#bf5af2' };
  if (type === 'DCH') return { label: '#ff9f0a', bg: 'rgba(255,159,10,.12)', border: '#ff9f0a' };
  if (type === 'V&V') return { label: '#ff375f', bg: 'rgba(255,55,95,.12)', border: '#ff375f' };
  return { label: '#d4af37', bg: 'rgba(212,175,55,.12)', border: '#d4af37' };
};

// StatusPill se importa de CollapsibleSection.jsx para evitar duplicidad y errores de referencia.

// ─── Componente de barra de ocupación ───────────────────────────
const OccupancyBar = React.memo(function OccupancyBar({ occupied, max }) {
  const pct = max > 0 ? Math.round((occupied / max) * 100) : 0;
  const color = pct >= 90 ? '#ff453a' : pct >= 60 ? '#ffd60a' : '#30d158';
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', letterSpacing: '.5px', textTransform: 'uppercase' }}>Asientos</span>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,.7)', fontVariantNumeric: 'tabular-nums' }}>{occupied}/{max}</span>
      </div>
      <div style={{ height: 3, borderRadius: 99, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 99,
          width: `${pct}%`,
          background: color,
          transition: 'width .6s cubic-bezier(.4,0,.2,1)',
          boxShadow: `0 0 8px ${color}88`,
        }} />
      </div>
    </div>
  );
});

// ─── Filtros por tipo de juego ───────────────────────────────────
const GameFilters = React.memo(function GameFilters({ tables, activeGame, onSelect }) {
  const stats = useMemo(() => {
    const map = {};
    for (const g of GAME_TYPES) {
      const mesas = tables.filter(t => (t.game || 'NLHE') === g);
      if (mesas.length === 0) continue;
      const activeTables = mesas.filter(t => t.status === 'active' || t.status === 'activa').length;
      const freeSeats = mesas.reduce((s, t) => s + Math.max(0, (t.maxSeats || 9) - (t.seatsOccupied || 0)), 0);
      const waiting = mesas.reduce((s, t) => s + (t.waitingCount || 0), 0);
      map[g] = { count: mesas.length, activeTables, freeSeats, waiting };
    }
    return map;
  }, [tables]);

  const games = Object.keys(stats);
  if (games.length === 0) return null;

  return (
    <div style={{
      display: 'flex', gap: 10, padding: '0 16px 14px',
      overflowX: 'auto', scrollbarWidth: 'none',
      width: '100%',
    }}>
      {/* Píldora "Todas" */}
      <button
        onClick={() => onSelect(null)}
        style={{
          flexShrink: 0, height: 40, padding: '0 20px', borderRadius: 99,
          border: activeGame === null ? '1px solid rgba(212,175,55,.5)' : '1px solid rgba(255,255,255,.1)',
          background: activeGame === null ? 'rgba(212,175,55,.15)' : 'rgba(255,255,255,.04)',
          color: activeGame === null ? '#d4af37' : 'rgba(255,255,255,.5)',
          fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          transition: 'all .2s ease',
        }}
      >
        Todas
      </button>

      {games.map(g => {
        const s = stats[g];
        const isActive = activeGame === g;
        const gc = gameColor(g);

        return (
          <button
            key={g}
            onClick={() => onSelect(isActive ? null : g)}
            style={{
              flexShrink: 0, padding: '0 16px', height: 40,
              borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12,
              border: isActive ? `1px solid ${gc.border}80` : '1px solid rgba(255,255,255,.1)',
              background: isActive ? gc.bg : 'rgba(255,255,255,.04)',
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all .2s ease',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 800, color: isActive ? gc.label : '#fff' }}>{g}</span>

            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,.1)' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Mesas Activas */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <LayoutGrid size={13} style={{ color: isActive ? gc.label : 'rgba(255,255,255,.3)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? '#fff' : 'rgba(255,255,255,.6)', fontVariantNumeric: 'tabular-nums' }}>
                  {s.activeTables}
                </span>
              </div>

              {/* Asientos Disponibles */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Armchair size={13} style={{ color: isActive ? gc.label : 'rgba(255,255,255,.3)' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: isActive ? '#fff' : 'rgba(255,255,255,.6)', fontVariantNumeric: 'tabular-nums' }}>
                  {s.freeSeats}
                </span>
              </div>

              {/* Lista de Espera */}
              {s.waiting > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Users size={13} style={{ color: '#ffd60a' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#ffd60a', fontVariantNumeric: 'tabular-nums' }}>
                    {s.waiting}
                  </span>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
});

// ─── Card de mesa ────────────────────────────────────────────────
const TableCard = React.memo(function TableCard({ t, index, onViewPlayers, expanded, onToggle }) {
  const [pressed, setPressed] = useState(false);
  const status = statusConfig(t.status);
  const waUrl = buildWhatsAppUrl(t);
  const isFull = t.seatsOccupied >= t.maxSeats;

  return (
    <div
      className="lobby-card-new"
      style={{
        animationDelay: `${index * 80}ms`,
        background: pressed ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.04)',
        cursor: 'pointer',
      }}
      onClick={onToggle}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
    >
      {/* Borde superior de acento */}
      <div style={{
        position: 'absolute', top: 0, left: 20, right: 20, height: 1,
        background: `linear-gradient(90deg, transparent, ${status.color}66, transparent)`,
      }} />

      {/* Header compacto — siempre visible */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <StatusPill label={status.label} color={status.color} bg={status.bg} dot={status.dot} pulse={status.pulse} />

          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.10)',
            borderRadius: 8, padding: '2px 8px', flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#d4af37' }}>{t.game || 'NLHE'}</span>
          </div>

          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: '-.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.name || 'Mesa'}
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {/* Asientos compactos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Armchair size={13} style={{ color: 'rgba(255,255,255,.4)' }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,.7)', fontVariantNumeric: 'tabular-nums' }}>
              {t.seatsOccupied}/{t.maxSeats}
            </span>
          </div>
          {/* Chevron */}
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2.5"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .25s ease', flexShrink: 0 }}
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Detalle expandido — animado */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: 14 }}>
              {/* Info grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', marginBottom: 14 }}>
                <InfoRow label="Ciegas" value={`$${fmtInt(t.sb)} / $${fmtInt(t.bb)}`} isGold />
                <InfoRow label="Buy-in" value={`${t.minBuyFmt} – ${t.maxBuyFmt}`} />
                <InfoRow label="En espera" value={`${fmtInt(t.waitingCount)} ${t.waitingCount === 1 ? 'persona' : 'personas'}`} accent={t.waitingCount > 0} />
                <InfoRow label="Jugadores" value={`${fmtInt(t.seatsOccupied)} / ${fmtInt(t.maxSeats)}`} />
              </div>

              {/* Barra de ocupación */}
              <OccupancyBar occupied={t.seatsOccupied} max={t.maxSeats} />

              {/* Acciones */}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); onViewPlayers(t.id); }}
                  style={{
                    flex: 1, height: 40, borderRadius: 12,
                    border: '1px solid rgba(255,255,255,.14)',
                    background: 'rgba(255,255,255,.06)',
                    color: 'rgba(255,255,255,.8)', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', transition: 'all .15s ease', fontFamily: 'inherit',
                  }}
                  onMouseEnter={e => e.target.style.background = 'rgba(255,255,255,.12)'}
                  onMouseLeave={e => e.target.style.background = 'rgba(255,255,255,.06)'}
                >
                  Ver mesa
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); waUrl && window.open(waUrl, '_blank'); }}
                  disabled={isFull}
                  style={{
                    flex: 1, height: 40, borderRadius: 12,
                    border: '1px solid rgba(212,175,55,.35)',
                    background: isFull ? 'rgba(255,255,255,.04)' : 'linear-gradient(135deg, rgba(212,175,55,.25), rgba(212,175,55,.12))',
                    color: isFull ? 'rgba(255,255,255,.3)' : '#d4af37',
                    fontSize: 13, fontWeight: 700,
                    cursor: isFull ? 'not-allowed' : 'pointer',
                    transition: 'all .15s ease', fontFamily: 'inherit',
                  }}
                >
                  {isFull ? 'Mesa llena' : 'Anotarme ✦'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// El componente PromoBanner fue extraído a src/components/promo-banner/PromoBanner.jsx

const InfoRow = React.memo(function InfoRow({ label, value, accent, isGold }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)', letterSpacing: '.6px', textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>
      <div style={{
        fontSize: 14,
        fontWeight: 600,
        color: isGold ? '#d4af37' : (accent ? '#ffd60a' : 'rgba(255,255,255,.85)'),
        fontVariantNumeric: 'tabular-nums'
      }}>
        {value}
      </div>
    </div>
  );
});

// ─── Modal de jugadores ──────────────────────────────────────────
function PlayersModal({ names, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10001,
        background: 'rgba(0,0,0,.8)',
        backdropFilter: 'blur(15px)',
        WebkitBackdropFilter: 'blur(15px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'rgba(30,32,40,.95)',
        border: '1px solid rgba(212,175,55,.25)',
        borderRadius: 28,
        padding: '32px 24px',
        boxShadow: '0 30px 70px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.05)',
        animation: 'modalScaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both',
      }}>
        <h3 style={{
          margin: '0 0 24px',
          fontSize: 20,
          fontWeight: 800,
          color: '#fff',
          textAlign: 'center',
          letterSpacing: '-.5px'
        }}>
          Detalles de la Mesa
        </h3>

        {names.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,.4)', fontSize: 14, margin: '24px 0' }}>
            No hay jugadores sentados
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {names.map((n, idx) => (
              <li key={idx} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 12,
                background: 'rgba(255,255,255,.06)',
                border: '1px solid rgba(255,255,255,.08)',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#30d158', boxShadow: '0 0 6px #30d158' }} />
                <span style={{ fontSize: 15, color: 'rgba(255,255,255,.9)', fontWeight: 500 }}>{n}</span>
              </li>
            ))}
          </ul>
        )}

        <button
          onClick={onClose}
          style={{
            width: '100%', height: 50, borderRadius: 14, marginTop: 20,
            border: '1px solid rgba(255,255,255,.12)',
            background: 'rgba(255,255,255,.08)',
            color: '#fff', fontSize: 15, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

// ─── Versión Cápsula de Mesa ─────────────────────────────────────
const TableCapsule = React.memo(function TableCapsule({ t, index, onToggle, expanded }) {
  const status = statusConfig(t.status);
  const isFull = t.seatsOccupied >= t.maxSeats;

  return (
    <div
      className="lobby-card-new capsule"
      onClick={onToggle}
      style={{
        padding: '12px 16px',
        borderRadius: '16px',
        marginBottom: '4px',
        animationDelay: `${index * 50}ms`
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <StatusPill label={status.label} color={status.color} bg={status.bg} dot={true} pulse={status.pulse} />

          <div style={{
            background: 'rgba(212,175,55,.1)', border: '1px solid rgba(212,175,55,.2)',
            borderRadius: 6, padding: '1px 6px', flexShrink: 0,
          }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#d4af37' }}>{t.game || 'NLHE'}</span>
          </div>

          <span style={{ fontSize: 12, fontWeight: 700, color: '#d4af37', flexShrink: 0 }}>
            ${fmtInt(t.sb)}/${fmtInt(t.bb)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(255,255,255,.05)', padding: '2px 8px', borderRadius: 6 }}>
            <Users size={11} style={{ color: isFull ? '#ff453a' : 'rgba(255,255,255,0.4)' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: isFull ? '#ff453a' : 'rgba(255,255,255,.7)' }}>
              {t.seatsOccupied}/{t.maxSeats}
            </span>
          </div>
          {(t.waitingCount || 0) > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(255,214,10,.1)', padding: '2px 8px', borderRadius: 6 }}>
              <span style={{ fontSize: 11, lineHeight: 1 }}>⏳</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#ffd60a' }}>
                {(t.waitingCount || 0)}
              </span>
            </div>
          ) : null}
          <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.2)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
      </div>
    </div>
  );
});

// ─── Versión Cápsula de Torneo ───────────────────────────────────
const TournamentCapsule = React.memo(function TournamentCapsule({ td3, onToggle, expanded, secondsLeft }) {
  const st = tourneyStatusConfig(td3);

  return (
    <div
      className="lobby-card-new capsule"
      onClick={onToggle}
      style={{
        padding: '12px 16px',
        borderRadius: '16px',
        marginBottom: '4px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: st.dot,
            boxShadow: st.pulse ? `0 0 8px ${st.dot}` : 'none'
          }} />

          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {td3?.tournamentName || 'Torneo'}
          </h3>

          <span style={{ fontSize: 13, fontWeight: 800, color: '#d4af37', marginLeft: 'auto', flexShrink: 0 }}>
            {fmtMXN(td3?.pot || 0)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ background: 'rgba(255,255,255,.05)', padding: '2px 8px', borderRadius: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>
              {td3?.isPaused ? td3Fmt(td3?.seconds) : td3Fmt(secondsLeft)}
            </span>
          </div>
          <ChevronRight size={14} style={{ color: 'rgba(255,255,255,0.2)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
      </div>
    </div>
  );
});

// ─── Card de Torneo ──────────────────────────────────────────────
const TournamentCard = React.memo(function TournamentCard({ td3, secondsLeft, addonSecondsLeft, nextBreakSecondsLeft, nextIsBreak, expanded, onToggle }) {
  const [pressed, setPressed] = useState(false);
  const waUrl = buildTourneyWhatsAppUrl(td3);
  const st = tourneyStatusConfig(td3);

  return (
    <div
      className="lobby-card-new"
      style={{
        background: pressed ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.04)',
        cursor: 'pointer',
      }}
      onClick={onToggle}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
    >
      <div style={{
        position: 'absolute', top: 0, left: 20, right: 20, height: 1,
        background: `linear-gradient(90deg, transparent, ${st.color}66, transparent)`,
      }} />

      {/* Header compacto — siempre visible */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <StatusPill label={st.label} color={st.color} bg={st.bg} dot={st.dot} pulse={st.pulse} />

          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-.3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {td3?.tournamentName || 'Torneo'}
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          {/* Bolsa Garantizada */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#d4af37' }}>{fmtMXN(td3?.pot || 0)}</span>
          </div>

          {/* Jugadores */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Users size={15} style={{ color: 'rgba(255,255,255,.4)' }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,.7)', fontVariantNumeric: 'tabular-nums' }}>{td3?.players || 0}</span>
          </div>

          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="2.5"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .25s ease', flexShrink: 0 }}
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded-tourney"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: 16 }}>
              <div style={td3?.isBreak ? {
                background: 'rgba(10,132,255,.05)',
                borderColor: 'rgba(10,132,255,.25)',
                borderRadius: 16,
                padding: 16,
                border: '1px solid rgba(10,132,255,.15)',
              } : {}}>
                {td3?.isBreak && (
                  <div className="td3-break-banner" style={{ justifyContent: 'center' }}>
                    <div className="td3-break-text" style={{ textAlign: 'center' }}>
                      <p className="td3-break-sub">
                        {td3?.round > 0 ? `Siguiente: Nivel ${td3.round + 1}` : 'Próximo nivel iniciando pronto'}
                      </p>
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ background: 'rgba(212,175,55,.08)', border: '1px solid rgba(212,175,55,.2)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px', minHeight: '140px' }}>
                    <span className="td3-label" style={{ color: 'rgba(212,175,55,.7)' }}>Nivel Actual</span>
                    {td3?.isBreak ? (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', marginTop: '8px' }}>
                        <div className="break-coffee-animation" style={{ width: '120px', height: '120px', position: 'relative' }}>
                          <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <style>{`
                              @keyframes steam1 {
                                0%, 100% { transform: translateY(0) scaleX(1); opacity: 0.4; }
                                50% { transform: translateY(-8px) scaleX(1.2); opacity: 0.7; }
                              }
                              @keyframes steam2 {
                                0%, 100% { transform: translateY(0) scaleX(1); opacity: 0.3; }
                                50% { transform: translateY(-6px) scaleX(0.9); opacity: 0.6; }
                              }
                              @keyframes steam3 {
                                0%, 100% { transform: translateY(0) scaleX(1); opacity: 0.35; }
                                50% { transform: translateY(-10px) scaleX(1.1); opacity: 0.65; }
                              }
                              @keyframes cupFloat {
                                0%, 100% { transform: translateY(0); }
                                50% { transform: translateY(-3px); }
                              }
                              @keyframes liquidShimmer {
                                0%, 100% { opacity: 0.6; }
                                50% { opacity: 0.9; }
                              }
                              .steam-1 { animation: steam1 2s ease-in-out infinite; transform-origin: center bottom; }
                              .steam-2 { animation: steam2 2.5s ease-in-out infinite 0.3s; transform-origin: center bottom; }
                              .steam-3 { animation: steam3 1.8s ease-in-out infinite 0.6s; transform-origin: center bottom; }
                              .cup-body { animation: cupFloat 3s ease-in-out infinite; }
                              .liquid-shimmer { animation: liquidShimmer 2s ease-in-out infinite; }
                            `}</style>
                            <g className="cup-body">
                              <ellipse cx="60" cy="95" rx="28" ry="6" fill="rgba(255,255,255,0.08)" />
                              <path d="M35 55 L40 90 Q42 95 60 95 Q78 95 80 90 L85 55 Z" fill="url(#cupGrad)" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                              <ellipse cx="60" cy="55" rx="25" ry="8" fill="url(#liquidGrad)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                              <ellipse cx="60" cy="55" rx="20" ry="5" fill="rgba(139,90,43,0.4)" className="liquid-shimmer" />
                              <path d="M85 62 Q100 62 100 72 Q100 82 85 82" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" />
                              <g className="steam-1" style={{ transformOrigin: '50px 45px' }}>
                                <path d="M48 48 Q46 38 50 28 Q54 18 48 8" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" />
                              </g>
                              <g className="steam-2" style={{ transformOrigin: '60px 45px' }}>
                                <path d="M58 48 Q56 36 62 26 Q68 16 58 6" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" />
                              </g>
                              <g className="steam-3" style={{ transformOrigin: '70px 45px' }}>
                                <path d="M68 48 Q66 40 72 30 Q78 20 68 10" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" strokeLinecap="round" />
                              </g>
                            </g>
                            <defs>
                              <linearGradient id="cupGrad" x1="35" y1="55" x2="85" y2="95" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="rgba(255,255,255,0.15)" />
                                <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
                              </linearGradient>
                              <radialGradient id="liquidGrad" cx="60" cy="55" r="25" gradientUnits="userSpaceOnUse">
                                <stop offset="0%" stopColor="rgba(180,120,60,0.5)" />
                                <stop offset="100%" stopColor="rgba(100,60,30,0.3)" />
                              </radialGradient>
                            </defs>
                          </svg>
                        </div>
                      </div>
                    ) : td3?.preStart ? (
                      <span style={{ fontSize: '24px', fontWeight: '600', color: 'rgba(255,255,255,0.45)', lineHeight: 1, display: 'flex', alignItems: 'center', animation: 'preStartPulse 2.5s ease-in-out infinite' }}>
                        Por comenzar
                      </span>
                    ) : (
                      <span style={{ fontSize: '90px', fontWeight: '800', color: '#d4af37', lineHeight: 1, textShadow: '0 0 20px rgba(212,175,55,0.3)', display: 'flex', alignItems: 'center' }}>
                        {td3?.round || '—'}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="td3-cell" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
                      <span className="td3-label" style={{ marginBottom: '4px' }}>{td3?.isBreak ? 'Descanso' : (td3?.preStart ? 'Empieza en' : 'Tiempo')}</span>
                      <span style={{ fontSize: '32px', fontWeight: '800', color: td3?.isBreak ? '#0a84ff' : (td3?.isPaused ? '#f5a623' : '#fff'), fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                        {td3?.isPaused ? td3Fmt(td3?.seconds) : td3Fmt(secondsLeft)}
                      </span>
                    </div>

                    <div className="td3-cell" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
                      <span className="td3-label" style={{ marginBottom: '4px' }}>Ciegas / Ante</span>
                      <span style={{ fontSize: '24px', fontWeight: '700', color: '#fff', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                        {td3?.sb || td3?.bb ? `${fmtInt(td3?.sb)} / ${fmtInt(td3?.bb)}${td3?.ante > 0 ? ` / ${fmtInt(td3?.ante)}` : ''}` : '—'}
                      </span>
                    </div>
                  </div>
                </div>

                {(() => {
                  const total = (td3?.seconds || 0) + (td3?.elapsedSec || 0);
                  const pct = total > 0 && !td3?.isBreak && !td3?.preStart ? Math.min(100, Math.max(0, (secondsLeft / total) * 100)) : 0;
                  return (
                    <div style={{ height: '8px', background: 'rgba(255,255,255,.06)', borderRadius: '99px', marginBottom: '18px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                      <div className={td3?.isPaused ? "progress-paused" : "progress-fuse"} style={{ height: '100%', width: `${pct}%`, transition: 'width 1s linear', borderRadius: '99px', position: 'relative' }} />
                    </div>
                  );
                })()}

                {/* Píldoras de Información Automática */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
                  {(addonSecondsLeft || 0) > 0 && (
                    <div style={{ background: 'rgba(255,159,10,.1)', border: '1px solid rgba(255,159,10,.3)', padding: '6px 14px', borderRadius: '99px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Registro Tardío:</span>
                      <span style={{ fontSize: '16px', fontWeight: '700', color: '#ff9f0a', fontVariantNumeric: 'tabular-nums' }}>{td3Fmt(addonSecondsLeft)}</span>
                    </div>
                  )}
                  {(nextBreakSecondsLeft || 0) > 0 ? (
                    <div style={{ background: 'rgba(10,132,255,.1)', border: '1px solid rgba(10,132,255,.3)', padding: '6px 16px', borderRadius: '99px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Próximo Descanso:</span>
                      <span style={{ fontSize: '16px', fontWeight: '700', color: '#0a84ff', fontVariantNumeric: 'tabular-nums' }}>{td3Fmt(nextBreakSecondsLeft)}</span>
                    </div>
                  ) : nextIsBreak ? (
                    <div style={{ background: 'rgba(10,132,255,.1)', border: '1px solid rgba(10,132,255,.3)', padding: '6px 16px', borderRadius: '99px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Siguiente:</span>
                      <span style={{ fontSize: '14px', fontWeight: '700', color: '#0a84ff' }}>☕ DESCANSO</span>
                    </div>
                  ) : null}
                </div>

                <div className="td3-cell" style={{ textAlign: 'center', background: 'rgba(0,0,0,.2)', marginBottom: '10px', padding: '16px' }}>
                  <span className="td3-label">Próximas Ciegas / Ante</span>
                  <span className="td3-value" style={{ color: 'rgba(255,255,255,.8)', fontSize: '24px' }}>
                    {td3?.nextSb || td3?.nextBb ? `${fmtInt(td3?.nextSb)} / ${fmtInt(td3?.nextBb)}${td3?.nextAnte > 0 ? ` / ${fmtInt(td3?.nextAnte)}` : ''}` : '—'}
                  </span>
                </div>

                <div className="td3-grid">
                  <div className="td3-cell"><span className="td3-label">Entradas</span><span className="td3-value" style={{ fontSize: '22px' }}>{fmtInt(td3?.entries)}</span></div>
                  <div className="td3-cell"><span className="td3-label">Jugadores</span><span className="td3-value" style={{ fontSize: '22px' }}>{fmtInt(td3?.players)}</span></div>
                  {td3?.rebuysAllowed && <div className="td3-cell"><span className="td3-label">Recompras</span><span className="td3-value" style={{ fontSize: '22px' }}>{fmtInt(td3?.rebuys)}</span></div>}
                  {(td3?.addonsAllowed && td3?.rebuysAllowed) && <div className="td3-cell"><span className="td3-label">Add-ons</span><span className="td3-value" style={{ fontSize: '22px' }}>{fmtInt(td3?.addons)}</span></div>}
                  <div className="td3-cell"><span className="td3-label">Promedio (Stack)</span><span className="td3-value" style={{ fontSize: '22px' }}>{fmtInt(td3?.avgStack)}</span></div>
                  <div className="td3-cell"><span className="td3-label">Fichas Totales</span><span className="td3-value" style={{ fontSize: '22px' }}>{fmtInt(td3?.chips)}</span></div>
                </div>

                <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
                  <button onClick={(e) => { e.stopPropagation(); waUrl && window.open(waUrl, '_blank'); }}
                    style={{
                      flex: 1, height: 40,
                      background: 'rgba(37, 211, 102, 0.08)',
                      border: '1px solid rgba(37, 211, 102, 0.25)',
                      borderRadius: '12px',
                      color: '#25d366',
                      fontSize: '13px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      fontFamily: 'inherit'
                    }}
                    onMouseEnter={e => e.target.style.background = 'rgba(37, 211, 102, 0.15)'}
                    onMouseLeave={e => e.target.style.background = 'rgba(37, 211, 102, 0.08)'}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor">
                      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.81 9.81 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.52-3.67 8.19-8.19 8.19-1.55 0-3.07-.43-4.39-1.25l-.31-.19-3.11.82.83-3.03-.21-.33a8.2 8.2 0 0 1-1.26-4.38c0-4.52 3.67-8.19 8.19-8.19h.22zm-3.54 3.03c-.15 0-.39.06-.6.27-.21.21-.81.79-.81 1.92 0 1.13.82 2.22.94 2.37.11.15 1.62 2.47 3.92 3.47.55.24.97.38 1.31.48.55.17 1.05.15 1.44.09.44-.07 1.35-.55 1.54-1.08.19-.53.19-.98.13-1.08-.06-.1-.21-.15-.45-.27-.24-.12-1.44-.71-1.66-.8-.22-.08-.38-.12-.55.12-.17.24-.65.81-.8 1-.15.17-.3.19-.55.07-.24-.12-1.02-.37-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.01-.38.11-.5.11-.11.24-.28.37-.42.12-.15.17-.25.25-.42.08-.17.04-.32-.02-.45-.06-.12-.55-1.33-.76-1.82-.2-.48-.41-.42-.6-.42z" />
                    </svg>
                    Información
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

// ─── Lobby principal ─────────────────────────────────────────────
export default function Lobby() {
  useAuthAnon();

  const { tournaments: tournamentList, loading: tourneyListLoading } = useTournamentList();
  const [selectedTournament, setSelectedTournament] = useState('currentTournament');

  // Auto-seleccionar el primer torneo si hay múltiples y no hay selección
  useEffect(() => {
    if (!tourneyListLoading && tournamentList.length > 0 && selectedTournament === 'currentTournament') {
      // Si hay múltiples torneos, seleccionar el primero que no sea currentTournament
      const nonDefault = tournamentList.find(t => t.id !== 'currentTournament');
      if (nonDefault) setSelectedTournament(nonDefault.id);
    }
  }, [tourneyListLoading, tournamentList]);

  const td3State = useTd3(selectedTournament);
  const { data: td3, secondsLeft, addonSecondsLeft, nextBreakSecondsLeft, nextIsBreak, show: showTd3 } = td3State;
  const { tables = [], loading, error } = useTables();
  const { promotions } = usePromotions();

  const [activeTab, setActiveTab] = useState('cash'); // 'cash' | 'tourney'

  const [cashExpanded, setCashExpanded] = useState(true);
  const [tourneyExpanded, setTourneyExpanded] = useState(true);
  const [openPlayersFor, setOpenPlayersFor] = React.useState(null);
  const [activeGame, setActiveGame] = useState(null);      // filtro por tipo de juego
  const [expandedCards, setExpandedCards] = useState(new Set()); // tarjetas expandidas
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);

  // Mesas filtradas por tipo de juego activo (declarado antes del effect que lo usa)
  const filteredTables = useMemo(() => {
    const list = activeGame ? tables.filter(t => (t.game || 'NLHE') === activeGame) : tables;
    return [...list].sort((a, b) => statusRank(a.status) - statusRank(b.status));
  }, [tables, activeGame]);

  // Auto-expandir las primeras 3 mesas y el torneo al cargar los datos
  useEffect(() => {
    if (!loading && filteredTables.length > 0 && !hasAutoExpanded) {
      setExpandedCards(prev => {
        const next = new Set(prev);
        // Todas empiezan colapsadas; solo el torneo se expande por defecto
        next.add('tourney-main');
        return next;
      });
      setHasAutoExpanded(true);
    }
  }, [loading, filteredTables, hasAutoExpanded]);

  const toggleCard = useCallback((id) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleViewPlayers = useCallback((id) => {
    setOpenPlayersFor(id);
  }, []);

  const handleCloseModal = useCallback(() => {
    setOpenPlayersFor(null);
  }, []);

  const hasTables = tables.length > 0;
  const showOverlay = activeTab === 'cash' ? (!hasTables && !loading) : !showTd3;

  const modalNames = useMemo(() => {
    const t = tables.find((x) => x.id === openPlayersFor);
    return t?.playerNames || [];
  }, [openPlayersFor, tables]);

  return (
    <>
      {/* Estilos globales inline */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&display=swap');

        /* Emil Kowalski design tokens — strong custom easings (built-in curves are too weak) */
        :root {
          --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
          --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
          --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
          --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        body { margin: 0; background: #0a0a14; }

        .lobby-new {
          min-height: 100vh;
          background: radial-gradient(ellipse 80% 50% at 50% -10%, rgba(212,175,55,.12), transparent 60%),
          radial-gradient(ellipse 60% 40% at 80% 80%, rgba(80,40,120,.08), transparent 60%),
          #0a0a0f;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif;
          padding: 0 0 90px; /* Espacio para el bottom nav */
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
        }

        .lobby-hero-new {
          position: relative;
          padding: 48px 20px 32px;
          text-align: center;
          overflow: hidden;
        }
        .lobby-hero-new::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(212,175,55,.4), transparent);
        }

        .lobby-wordmark {
          font-family: 'Cormorant Garamond', 'Georgia', serif;
          font-size: clamp(2.2rem, 8vw, 3.8rem);
          font-weight: 700;
          letter-spacing: -.5px;
          margin: 12px 0 4px;
          line-height: 1;
          background: linear-gradient(135deg, #fff 30%, #d4af37 60%, #fff 90%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .lobby-subtitle {
          font-size: 11px;
          letter-spacing: 3px;
          text-transform: uppercase;
          color: rgba(212,175,55,.6);
          margin: 0;
        }

        .lobby-logo-new {
          width: 284px;
          height: 104px;
          object-fit: contain;
          filter: drop-shadow(0 0 16px rgba(212,175,55,.3));
        }

        .lobby-list-new {
          max-width: 560px;
          margin: 0 auto;
          padding: 0 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 200px;
        }

        .lobby-card-new {
          position: relative;
          border-radius: 20px;
          padding: 18px 18px 16px;
          border: 1px solid rgba(255,255,255,.08);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          box-shadow:
            0 1px 0 rgba(255,255,255,.06) inset,
            0 20px 40px rgba(0,0,0,.35);
          transition: transform .2s ease, box-shadow .2s ease;
          overflow: hidden;
        }

        .lobby-card-new:hover {
          transform: translateY(-2px);
          box-shadow:
            0 1px 0 rgba(255,255,255,.08) inset,
            0 28px 50px rgba(0,0,0,.45);
        }

        .td3-card-new {
          width: 100%;
        }

        .td3-inner {
          border-radius: 20px;
          padding: 24px 20px;
          background: rgba(212,175,55,.04);
          border: 1px solid rgba(212,175,55,.15);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .td3-title {
          display: flex; align-items: center; gap: 8px; justify-content: center;
          margin: 0 0 12px;
          font-size: 18px; font-weight: 700; color: #d4af37;
        }

        .badge-live-new {
          font-size: 10px; font-weight: 800; letter-spacing: 1px;
          padding: 2px 7px; border-radius: 99px;
          background: #ff453a; color: #fff;
          animation: pulse 1.5s ease infinite;
        }
        .badge-break {
          font-size: 10px; font-weight: 800; letter-spacing: 1px;
          padding: 2px 7px; border-radius: 99px;
          background: #0a84ff; color: #fff;
          animation: pulse 2s ease infinite;
        }
        .badge-paused {
          font-size: 10px; font-weight: 800; letter-spacing: 1px;
          padding: 2px 7px; border-radius: 99px;
          background: #f5a623; color: #000;
          animation: pulse 2s ease infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .6; }
        }
        @keyframes preStartPulse {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.02); }
        }

        .progress-fuse {
          position: relative;
          background: linear-gradient(90deg, #ff3b30, #ff9500, #ffcc00);
          background-size: 200% 100%;
          animation: fuse-body 2s linear infinite;
        }
        .progress-fuse::after {
          content: '';
          position: absolute;
          right: -6px;
          top: 50%;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #fff;
          z-index: 10;
          animation: fuse-spark 0.08s infinite alternate;
        }
        
        .progress-paused {
          background: #f5a623;
          animation: glow-orange 2s ease-in-out infinite;
        }

        @keyframes fuse-body {
          0% { background-position: 100% 0; }
          100% { background-position: 0 0; }
        }
        @keyframes fuse-spark {
          0% { 
            transform: translateY(-50%) scale(0.8); 
            box-shadow: 0 0 4px #fff, 0 0 10px #ffcc00, 0 0 15px #ff9500; 
            background: #fff;
          }
          50% {
            background: #ffcc00;
          }
          100% { 
            transform: translateY(-50%) scale(1.4); 
            box-shadow: 0 0 10px #fff, 0 0 20px #ffcc00, 0 0 35px #ff9500, 0 0 50px #ff3b30; 
            background: #fff;
          }
        }
        @keyframes glow-orange {
          0%, 100% { box-shadow: 0 0 4px rgba(245,166,35,0.4); }
          50% { box-shadow: 0 0 12px rgba(245,166,35,0.9); }
        }

        .td3-break-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          background: rgba(10,132,255,.12);
          border: 1px solid rgba(10,132,255,.3);
          border-radius: 12px;
          padding: 10px 14px;
          margin-bottom: 24px;
        }
        .td3-break-icon {
          font-size: 22px;
          line-height: 1;
        }
        .td3-break-text {
          flex: none;
        }
        .td3-break-sub {
          font-size: 13px; color: rgba(255,255,255,.8); font-weight: 500;
          margin: 0;
        }

        .td3-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }

        .td3-cell {
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.06);
          border-radius: 12px;
          padding: 10px 12px;
        }

        .td3-label {
          font-size: 10px; color: rgba(255,255,255,.4);
          letter-spacing: .6px; text-transform: uppercase; display: block; margin-bottom: 4px;
        }

        .td3-value {
          font-size: 16px; font-weight: 700; color: #fff;
          font-variant-numeric: tabular-nums;
        }

        .lobby-empty {
          text-align: center;
          padding: 80px 20px;
          color: rgba(255,255,255,.3);
          font-size: 15px;
        }

        /* BOTTOM NAV STYLES */
        .bottom-nav {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          height: 70px;
          background: rgba(15, 15, 18, 0.9);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: space-around;
          padding-bottom: env(safe-area-inset-bottom, 0);
          z-index: 1000;
        }

        .nav-btn {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 100%;
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.3);
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }

        .nav-btn svg {
          width: 22px;
          height: 22px;
          fill: none;
          stroke: currentColor;
          stroke-width: 2.2;
          stroke-linecap: round;
          stroke-linejoin: round;
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .nav-btn span {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.3px;
        }

        .nav-btn.nav-active {
          color: #fff;
        }
        .nav-btn.nav-active svg {
          transform: translateY(-2px);
          stroke-width: 2.5;
        }

        .nav-tourney-live {
          color: #d4af37;
        }
        .nav-tourney-live.nav-active {
          color: #ffd60a;
        }

        .nav-dot {
          position: absolute;
          top: 14px;
          right: calc(50% - 16px);
          width: 8px;
          height: 8px;
          background: #ff453a;
          border-radius: 50%;
          box-shadow: 0 0 0 2px #0f0f12;
          animation: pulse 1.5s ease infinite;
        }

        /* PREMIUM OVERLAY STYLES */
        .so-wrapper-premium {
          position: fixed;
          inset: 0;
          z-index: 900;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #0a0a0f;
          overflow: hidden;
          padding-bottom: 80px; /* Desplaza el contenido hacia arriba para no chocar con el nav */
        }

        .so-ambient-glow {
          position: absolute;
          width: 150%;
          height: 150%;
          background: radial-gradient(circle at 50% 50%, rgba(212,175,55,0.1), transparent 50%),
                      radial-gradient(circle at 20% 80%, rgba(80,40,120,0.15), transparent 40%);
          animation: ambientRotate 20s linear infinite;
        }

        @keyframes ambientRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .so-card-premium {
          position: relative;
          width: min(90vw, 420px);
          padding: 2px;
          border-radius: 32px;
          background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02));
          box-shadow: 0 40px 100px rgba(0,0,0,0.8);
        }

        .so-card-content {
          position: relative;
          background: #0f0f14;
          border-radius: 30px;
          padding: 36px 32px 28px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }

        .so-logo-container {
          position: relative;
          margin-bottom: 24px;
          perspective: 800px;
        }

        .so-logo-premium {
          width: 160px;
          height: 160px;
          object-fit: contain;
          position: relative;
          z-index: 2;
          filter: drop-shadow(0 0 20px rgba(212,175,55,0.3));
          animation: soFloat 4s ease-in-out infinite;
        }

        @keyframes soFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        .so-logo-glow {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 120px; height: 120px;
          background: #d4af37;
          filter: blur(60px);
          opacity: 0.2;
          border-radius: 50%;
        }

        .so-title-premium {
          font-family: 'Cormorant Garamond', serif;
          font-size: 28px;
          color: #fff;
          margin: 0 0 16px;
          line-height: 1.2;
          font-weight: 600;
        }

        .so-brand-name {
          display: block;
          font-size: 36px;
          font-weight: 700;
          background: linear-gradient(135deg, #fff, #d4af37);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .so-separator {
          width: 40px;
          height: 2px;
          background: #d4af37;
          margin: 0 0 20px;
          opacity: 0.5;
          border-radius: 99px;
        }

        .so-sub-premium {
          font-size: 15px;
          color: rgba(255,255,255,0.6);
          margin: 0 0 32px;
          font-weight: 400;
          letter-spacing: 0.2px;
        }

        .so-ripples {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          z-index: 1;
        }

        .so-ripple-ring {
          position: absolute;
          width: 360px;
          height: 360px;
          border-radius: 50%;
          border: 1.5px solid rgba(212, 175, 55, 0.5);
        }

        /* ─── AVANT-GARDE STAGE (replaces single ambient glow) ─── */
        .so-stage {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }
        .so-stage-glow {
          position: absolute;
          width: 220%;
          height: 220%;
          top: -60%;
          left: -60%;
          background:
            radial-gradient(ellipse 38% 30% at 50% 32%, rgba(212,175,55,0.18), transparent 60%),
            radial-gradient(ellipse 30% 26% at 78% 78%, rgba(74,127,255,0.10), transparent 65%),
            radial-gradient(ellipse 28% 24% at 22% 76%, rgba(255,140,66,0.08), transparent 65%);
          animation: soStageBreathe 12s var(--ease-in-out) infinite;
          will-change: transform, opacity;
        }
        @keyframes soStageBreathe {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.85; }
          50%      { transform: scale(1.06) rotate(2deg); opacity: 1; }
        }

        /* Film grain — SVG noise, 4% opacity, overlay blend */
        .so-grain {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.05;
          mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.85  0 0 0 0 0.75  0 0 0 0 0.5  0 0 0 1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
          background-size: 240px 240px;
        }

        /* 3 concentric halo rings around the logo — staggered breathing */
        .so-halo-stack {
          position: absolute;
          top: 50%; left: 50%;
          width: 200px; height: 200px;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }
        .so-halo {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(212,175,55,0.55), transparent 70%);
          filter: blur(28px);
          will-change: transform, opacity;
          animation: soHaloBreathe 4s var(--ease-in-out) infinite;
        }
        .so-halo--1 { opacity: 0.45; animation-delay: 0s; }
        .so-halo--2 { top: -25%; left: -25%; width: 150%; height: 150%; opacity: 0.28; animation-delay: 1.3s; animation-duration: 5s; }
        .so-halo--3 { top: -50%; left: -50%; width: 200%; height: 200%; opacity: 0.15; animation-delay: 2.6s; animation-duration: 6s; }
        @keyframes soHaloBreathe {
          0%, 100% { transform: scale(0.95); }
          50%      { transform: scale(1.18); }
        }

        /* Logo idle: subtle 3D Y-axis rotation + float (Apple Dynamic Island feel) */
        .so-logo-premium {
          position: relative;
          z-index: 2;
          transform-style: preserve-3d;
          animation: soLogoIdle 9s var(--ease-in-out) infinite;
        }
        @keyframes soLogoIdle {
          0%, 100% { transform: translateY(0) rotateY(0deg); }
          25%      { transform: translateY(-6px) rotateY(2deg); }
          50%      { transform: translateY(0) rotateY(0deg); }
          75%      { transform: translateY(-6px) rotateY(-2deg); }
        }

        /* Title — animated gradient (subtle hue shift) */
        .so-brand-name {
          display: block;
          font-size: 36px;
          font-weight: 700;
          background: linear-gradient(135deg, #fff 0%, #d4af37 40%, #f4d77a 50%, #d4af37 60%, #fff 100%);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: soGradientShift 8s var(--ease-in-out) infinite;
        }
        @keyframes soGradientShift {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }

        /* Loading bar — single shimmer sweep across full width (Emil: one clear motion) */
        .so-loading-bar {
          position: relative;
          width: 100%;
          max-width: 200px;
          height: 3px;
          margin-top: 4px;
          background: rgba(255,255,255,0.05);
          border-radius: 99px;
          overflow: hidden;
        }
        .so-loading-fill {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 60%;
          border-radius: 99px;
          background: linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.95) 50%, transparent 100%);
          filter: blur(0.5px);
          animation: soShimmer 2.2s linear infinite;
          will-change: transform;
        }
        @keyframes soShimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(220%); }
        }

        /* Bottom status row — 3 cycling dots, offset breathing */
        .so-status-row {
          display: flex; align-items: center; gap: 10px;
          margin-top: 18px;
          font-size: 11px;
          letter-spacing: 2.5px;
          text-transform: uppercase;
          color: rgba(212,175,55,0.55);
          font-weight: 600;
        }
        .so-status-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: rgba(212,175,55,0.6);
          animation: soDotBreathe 1.8s var(--ease-in-out) infinite;
        }
        .so-status-dot:nth-child(2) { animation-delay: 0.3s; }
        .so-status-dot:nth-child(3) { animation-delay: 0.6s; }
        @keyframes soDotBreathe {
          0%, 100% { opacity: 0.3; transform: scale(0.85); }
          50%      { opacity: 1; transform: scale(1.15); }
        }

        /* WhatsApp CTA — full-width, in-card, single subtle ring (was floating) */
        .so-wa-premium {
          position: relative;
          display: flex; align-items: center; justify-content: center; gap: 10px;
          width: 100%;
          height: 48px;
          margin-top: 22px;
          padding: 0 24px;
          background: linear-gradient(135deg, rgba(37,211,102,0.18), rgba(37,211,102,0.08));
          border: 1px solid rgba(37,211,102,0.32);
          border-radius: 14px;
          color: #4ee584;
          text-decoration: none;
          font-weight: 600;
          font-size: 14px;
          font-family: inherit;
          letter-spacing: 0.3px;
          box-shadow:
            0 6px 18px rgba(37,211,102,0.12),
            inset 0 1px 0 rgba(255,255,255,0.06);
          cursor: pointer;
          transition: transform 200ms var(--ease-out), box-shadow 200ms var(--ease-out), background 200ms var(--ease-out);
        }
        .so-wa-premium::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 14px;
          border: 1px solid rgba(37,211,102,0.35);
          opacity: 0;
          pointer-events: none;
          transition: transform 600ms var(--ease-out), opacity 600ms var(--ease-out);
        }
        .so-wa-premium:hover {
          background: linear-gradient(135deg, rgba(37,211,102,0.24), rgba(37,211,102,0.12));
          box-shadow: 0 10px 24px rgba(37,211,102,0.18), inset 0 1px 0 rgba(255,255,255,0.08);
        }
        .so-wa-premium:hover::after {
          transform: scale(1.06);
          opacity: 0.6;
        }
        .so-wa-premium:active { transform: scale(0.98); }
        .so-wa-premium:focus-visible {
          outline: 2px solid rgba(37,211,102,0.7);
          outline-offset: 3px;
        }

        /* ─── EMPTY STATES (cash + tourney) ─── */
        .lobby-empty {
          padding: 64px 20px;
          text-align: center;
          color: rgba(255,255,255,0.35);
          min-height: 220px;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
        }
        .lobby-empty-stack {
          position: relative;
          width: 96px; height: 72px;
          margin-bottom: 18px;
          perspective: 600px;
        }
        .lobby-empty-card {
          position: absolute;
          inset: 0;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(212,175,55,0.18), rgba(212,175,55,0.06));
          border: 1px solid rgba(212,175,55,0.28);
          box-shadow: 0 8px 18px rgba(0,0,0,0.35);
          transform-style: preserve-3d;
        }
        .lobby-empty-card--1 {
          animation: soEmptyCard1 5s var(--ease-in-out) infinite;
        }
        .lobby-empty-card--2 {
          animation: soEmptyCard2 5s var(--ease-in-out) infinite;
          animation-delay: 0.2s;
        }
        .lobby-empty-card--3 {
          animation: soEmptyCard3 5s var(--ease-in-out) infinite;
          animation-delay: 0.4s;
        }
        @keyframes soEmptyCard1 {
          0%, 100% { transform: translate(-32px, 0) rotate(-8deg); opacity: 0.6; }
          50%      { transform: translate(-32px, -4px) rotate(-12deg); opacity: 0.8; }
        }
        @keyframes soEmptyCard2 {
          0%, 100% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          50%      { transform: translate(0, -8px) rotate(0deg); opacity: 1; }
        }
        @keyframes soEmptyCard3 {
          0%, 100% { transform: translate(32px, 0) rotate(8deg); opacity: 0.6; }
          50%      { transform: translate(32px, -4px) rotate(12deg); opacity: 0.8; }
        }
        .lobby-empty-trophy {
          width: 56px; height: 56px;
          margin-bottom: 14px;
          position: relative;
        }
        .lobby-empty-trophy::after {
          content: '';
          position: absolute;
          inset: -16px;
          background: radial-gradient(circle, rgba(212,175,55,0.35), transparent 70%);
          filter: blur(16px);
          animation: soTrophyGlow 2.6s var(--ease-in-out) infinite;
          z-index: -1;
        }
        @keyframes soTrophyGlow {
          0%, 100% { transform: scale(0.9); opacity: 0.5; }
          50%      { transform: scale(1.15); opacity: 0.9; }
        }
        .lobby-empty-label {
          font-size: 13px;
          color: rgba(255,255,255,0.5);
          letter-spacing: 0.4px;
          font-weight: 500;
        }
        .lobby-empty-hint {
          font-size: 11px;
          color: rgba(255,255,255,0.25);
          letter-spacing: 1.2px;
          text-transform: uppercase;
          margin-top: 6px;
        }

        /* ─── Reduced motion — keep opacity, drop all transforms ─── */
        @media (prefers-reduced-motion: reduce) {
          .so-stage-glow,
          .so-halo,
          .so-logo-premium,
          .so-brand-name,
          .so-loading-fill,
          .so-status-dot,
          .lobby-empty-card,
          .lobby-empty-trophy::after {
            animation: none !important;
          }
          .lobby-empty-card { opacity: 0.7; }
          .so-loading-fill { opacity: 0.6; }
        }

      `}</style>

      <div className="lobby-new">
        {/* HEADER */}
        <header className="lobby-hero-new">
          <img className="lobby-logo-new" src="/branding/logo.png" alt="Experience Poker" />
          <h1 className="lobby-wordmark">Experience Poker</h1>
          <p className="lobby-subtitle">· Poker Room ·</p>
        </header>

        <StartOverlay show={showOverlay} phone={CASINO_PHONE} />

        {/* BANNER DE ANUNCIOS */}
        <PromoBanner promotions={promotions} />

        {/* PESTAÑA: CASH GAMES */}
        <AnimatePresence mode="wait">
          {activeTab === 'cash' && (
            <motion.main
              key="tab-cash"
              className="lobby-list-new"
              aria-live="polite"
              style={{ minHeight: '400px' }}
              initial={{ opacity: 0, transform: 'translateX(-48px)', filter: 'blur(6px)' }}
              animate={{
                opacity: 1,
                transform: 'translateX(0)',
                filter: 'blur(0px)',
                transition: { type: 'spring', duration: 0.5, bounce: 0.18 },
              }}
              exit={{ opacity: 0, transform: 'translateX(48px)', filter: 'blur(4px)', transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] } }}
            >
              {/* Filtros por tipo de juego */}
              <GameFilters
                tables={tables}
                activeGame={activeGame}
                onSelect={setActiveGame}
              />

              <CollapsibleSection
                title="Cash"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" strokeDasharray="3 3" />
                  </svg>
                }
                badge={loading ? '...' : filteredTables.length}
                defaultExpanded={cashExpanded}
                onToggle={setCashExpanded}
              >
                {loading && (
                  <div className="lobby-empty">Cargando mesas...</div>
                )}

                {!loading && tables.length === 0 && (
                  <div className="lobby-empty">
                    <div className="lobby-empty-stack" aria-hidden="true">
                      <div className="lobby-empty-card lobby-empty-card--1" />
                      <div className="lobby-empty-card lobby-empty-card--2" />
                      <div className="lobby-empty-card lobby-empty-card--3" />
                    </div>
                    <div className="lobby-empty-label">Sin mesas activas ahora</div>
                    <div className="lobby-empty-hint">Mantente atento</div>
                  </div>
                )}

                {filteredTables.map((t, i) => {
                  const isExpanded = expandedCards.has(t.id);

                  if (!isExpanded) {
                    return (
                      <TableCapsule
                        key={t.id}
                        t={t}
                        index={i}
                        expanded={false}
                        onToggle={() => toggleCard(t.id)}
                      />
                    );
                  }

                  return (
                    <TableCard
                      key={t.id}
                      t={t}
                      index={i}
                      onViewPlayers={handleViewPlayers}
                      expanded={true}
                      onToggle={() => toggleCard(t.id)}
                    />
                  );
                })}
              </CollapsibleSection>
            </motion.main>
          )}
        </AnimatePresence>

        {/* PESTAÑA: TORNEOS */}
        <AnimatePresence mode="wait">
          {activeTab === 'tourney' && (
            <motion.main
              key="tab-tourney"
              className="lobby-list-new"
              aria-live="polite"
              style={{ minHeight: '400px' }}
              initial={{ opacity: 0, transform: 'translateX(48px)', filter: 'blur(6px)' }}
              animate={{
                opacity: 1,
                transform: 'translateX(0)',
                filter: 'blur(0px)',
                transition: { type: 'spring', duration: 0.5, bounce: 0.18 },
              }}
              exit={{ opacity: 0, transform: 'translateX(-48px)', filter: 'blur(4px)', transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] } }}
            >
              <CollapsibleSection
                title="Torneos"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6V2h12v2h1.5a2.5 2.5 0 0 1 0 5H18a6 6 0 0 1-12 0Z" />
                    <path d="M12 15v4M9 22h6" />
                  </svg>
                }
                badge={showTd3 ? 'LIVE' : null}
                defaultExpanded={tourneyExpanded}
                onToggle={setTourneyExpanded}
              >
                {!showTd3 ? (
                  <motion.div
                    initial={{ opacity: 0, transform: 'translateY(10px)' }}
                    animate={{ opacity: 1, transform: 'translateY(0)' }}
                    exit={{ opacity: 0, transform: 'scale(0.95)', transition: { duration: 0.25 } }}
                    transition={{ type: 'spring', duration: 0.5, bounce: 0.15 }}
                    className="lobby-empty"
                  >
                    <div className="lobby-empty-trophy" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="56" height="56" fill="none" stroke="#d4af37" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6V2h12v2h1.5a2.5 2.5 0 0 1 0 5H18a6 6 0 0 1-12 0Z" />
                        <path d="M12 15v4M9 22h6" />
                        <path d="M8 22h8" />
                      </svg>
                    </div>
                    <div className="lobby-empty-label">Sin torneos activos</div>
                    <div className="lobby-empty-hint">Próximamente</div>
                  </motion.div>
                ) : (
                  <>
                    {/* Tournament Selector */}
                    {tournamentList.length > 1 && (
                      <div style={{ marginBottom: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {tournamentList.map(t => (
                          <button
                            key={t.id}
                            onClick={() => setSelectedTournament(t.id)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '99px',
                              border: selectedTournament === t.id ? '1px solid rgba(212,175,55,.4)' : '1px solid rgba(255,255,255,.1)',
                              background: selectedTournament === t.id ? 'rgba(212,175,55,.15)' : 'rgba(255,255,255,.05)',
                              color: selectedTournament === t.id ? '#d4af37' : 'rgba(255,255,255,.5)',
                              fontSize: '12px',
                              fontWeight: selectedTournament === t.id ? '700' : '500',
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              transition: 'all .15s ease',
                            }}
                          >
                            {t.name || t.id}
                          </button>
                        ))}
                      </div>
                    )}
                    <TournamentCard
                      key={`${selectedTournament}-card`}
                      td3={td3}
                      secondsLeft={secondsLeft}
                      addonSecondsLeft={addonSecondsLeft}
                      nextBreakSecondsLeft={nextBreakSecondsLeft}
                      nextIsBreak={nextIsBreak}
                      expanded={expandedCards.has('tourney-main')}
                      onToggle={() => toggleCard('tourney-main')}
                    />
                  </>
                )}
              </CollapsibleSection>
            </motion.main>
          )}
        </AnimatePresence>

        {/* FLOATING BOTTOM DOCK (iPhone Style) */}
        <div className="bottom-dock-container">
          <nav className="bottom-dock">
            <button
              onClick={() => setActiveTab('cash')}
              className={`dock-item ${activeTab === 'cash' ? 'active' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" strokeDasharray="3 3" />
              </svg>
              <span>Cash</span>
            </button>

            <button
              onClick={() => setActiveTab('tourney')}
              className={`dock-item ${activeTab === 'tourney' ? 'active' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6V2h12v2h1.5a2.5 2.5 0 0 1 0 5H18a6 6 0 0 1-12 0Z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 15v4M9 22h6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Torneos</span>
              {showTd3 && <span className="dock-badge-live"></span>}
            </button>
          </nav>
        </div>

        {/* MODAL JUGADORES */}
        {openPlayersFor && (
          <PlayersModal
            names={modalNames}
            onClose={handleCloseModal}
          />
        )}
      </div>
    </>
  );
}