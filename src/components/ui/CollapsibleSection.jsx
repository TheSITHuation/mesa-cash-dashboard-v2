// src/components/ui/CollapsibleSection.jsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Armchair, Users, ChevronDown, Trophy,
} from 'lucide-react';

const fmtNum = (n) => {
  const x = Number(n || 0);
  if (x >= 1_000_000) return `${(x / 1_000_000).toFixed(1)}M`;
  if (x >= 1_000)     return `${(x / 1_000).toFixed(0)}k`;
  return String(x);
};

const gameColors = {
  NLHE: { bg: '#a855f720', border: '#a855f7', label: '#a855f7' },
  PLO:  { bg: '#22c55e20', border: '#22c55e', label: '#22c55e' },
  MTT:  { bg: '#f9731620', border: '#f97316', label: '#f97316' },
  MAA:  { bg: '#3b82f620', border: '#3b82f6', label: '#3b82f6' },
  DCH:  { bg: '#ef444420', border: '#ef4444', label: '#ef4444' },
  VV:   { bg: '#eab30820', border: '#eab308', label: '#eab308' },
};
const gameColor = (g) => gameColors[g?.toUpperCase()] || { bg: '#63636620', border: '#636366', label: '#636366' };

const statusConfig = (st) => {
  const v = String(st || '').toLowerCase();
  if (v === 'active')    return { label: 'Activa',    color: '#30d158', bg: '#30d15820', dot: true,  pulse: true  };
  if (v === 'en-espera') return { label: 'En espera', color: '#ffd60a', bg: '#ffd60a20', dot: true,  pulse: false };
  return                        { label: 'Inactiva', color: '#636366', bg: '#63636620', dot: false, pulse: false };
};

const tourneyStatus = (td3) => {
  if (td3?.isPaused)  return { label: 'Pausado', color: '#ffd60a', bg: '#ffd60a20', dot: true  };
  if (td3?.isBreak)   return { label: 'Descanso', color: '#0a84ff', bg: '#0a84ff20', dot: true  };
  if (!td3?.isBreak && !td3?.preStart && (td3?.round > 0 || (td3?.seconds || 0) > 0)) {
    return { label: 'En Vivo', color: '#30d158', bg: '#30d15820', dot: true };
  }
  return { label: 'Inactivo', color: '#636366', bg: '#63636620', dot: false };
};

export function StatusPill({ label, color, bg, dot, pulse }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10, fontWeight: 700, letterSpacing: '.8px', textTransform: 'uppercase',
      color, background: bg, border: `1px solid ${color}40`,
      padding: '2px 8px', borderRadius: 99, flexShrink: 0,
    }}>
      {dot && <span className={pulse ? 'status-dot-pulse' : ''} style={{
        width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: pulse ? `0 0 5px ${color}` : 'none',
      }} />}
      {label}
    </span>
  );
}

function TableCapsule({ table, onExpand }) {
  const gc = gameColor(table.game);
  const st = statusConfig(table.status);
  const available = (table.maxSeats || 9) - (table.seatsOccupied || 0);

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        background: 'rgba(255,255,255,.04)',
        border: '1px solid rgba(255,255,255,.08)',
        borderRadius: 14,
        cursor: 'pointer',
        gap: 10,
        marginBottom: 0,
        minHeight: 44,
      }}
      onClick={onExpand}
      role="button"
      aria-label={`Expandir mesa ${table.name || 'Mesa'}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <StatusPill label={st.label} color={st.color} bg={st.bg} dot={st.dot} pulse={st.pulse} />

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: gc.bg, border: `1px solid ${gc.border}40`,
          borderRadius: 8, padding: '2px 9px', flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: gc.label }}>{table.game || 'NLHE'}</span>
        </div>

        <span style={{
          fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.85)',
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {table.name || 'Mesa'}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <Armchair size={13} style={{ color: 'rgba(255,255,255,.4)' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.7)', fontVariantNumeric: 'tabular-nums' }}>
            {available}
          </span>
        </div>
      </div>

      <ChevronDown size={16} style={{ color: 'rgba(255,255,255,.4)', flexShrink: 0 }} />
    </div>
  );
}

function TournamentCapsule({ td3, secondsLeft, onExpand }) {
  const st = tourneyStatus(td3);
  const name = td3?.tournamentName || 'Torneo';
  const gtzo = fmtNum(td3?.pot || 0);

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        background: 'rgba(255,255,255,.04)',
        border: '1px solid rgba(255,255,255,.08)',
        borderRadius: 14,
        cursor: 'pointer',
        gap: 10,
        marginBottom: 0,
        minHeight: 44,
      }}
      onClick={onExpand}
      role="button"
      aria-label={`Expandir torneo ${name}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <StatusPill label={st.label} color={st.color} bg={st.bg} dot={st.dot} />

        <Trophy size={13} style={{ color: '#d4af37', flexShrink: 0 }} />
        <span style={{
          fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.85)',
          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {name}
        </span>

        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.45)', flexShrink: 0 }}>GTZ:</span>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#d4af37', flexShrink: 0 }}>{gtzo}</span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <Users size={13} style={{ color: 'rgba(255,255,255,.4)' }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.7)', fontVariantNumeric: 'tabular-nums' }}>
            {td3?.players || 0}
          </span>
        </div>
      </div>

      <ChevronDown size={16} style={{ color: 'rgba(255,255,255,.4)', flexShrink: 0 }} />
    </div>
  );
}

export default function CollapsibleSection({
  title, icon, badge,
  defaultExpanded = true,
  onToggle,
  capsules = null,
  capsuleType = 'table',
  td3 = null,
  secondsLeft = 0,
  children = null,
  onExpandItem = null,
  renderExpandedItem = null,
  className = '',
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [activeItemId, setActiveItemId] = useState(null);

  useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  const handleToggle = () => {
    const newState = !expanded;
    setExpanded(newState);
    setActiveItemId(null);
    onToggle?.(newState);
  };

  const handleExpandItem = (id) => {
    const next = activeItemId === id ? null : id;
    setActiveItemId(next);
    if (next !== null && !expanded) {
      setExpanded(true);
      onToggle?.(true);
    }
  };

  const activeItem = activeItemId !== null && capsules
    ? capsules.find((c, i) => (c.id || i) === activeItemId)
    : null;

  const showCapsules = !expanded && capsules && capsules.length > 0 && !activeItem;
  const showAllCards = expanded && !activeItem;
  const showSingleItem = activeItemId !== null && activeItem;

  return (
    <div className={`collapsible-section ${className}`} style={{ position: 'relative', zIndex: 1 }}>
      <motion.button
        className="collapsible-header"
        onClick={handleToggle}
        whileTap={{ scale: 0.98 }}
        type="button"
        style={{ border: 'none', background: 'none', width: '100%', textAlign: 'left' }}
      >
        <div className="collapsible-header-left">
          {icon}
          <span className="collapsible-title">{title}</span>
          {badge != null && <span className="collapsible-badge">{badge}</span>}
        </div>
        <motion.span
          className="collapsible-chevron"
          animate={{ rotate: expanded || activeItemId !== null ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <ChevronDown size={20} />
        </motion.span>
      </motion.button>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6 }}>
        {showCapsules && capsules.map((c, i) => (
          <motion.div
            key={c.id || i}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          >
            {capsuleType === 'tournament' ? (
              <TournamentCapsule
                td3={c.td3 || td3}
                secondsLeft={c.secondsLeft || secondsLeft}
                onExpand={() => handleExpandItem(c.id || i)}
              />
            ) : (
              <TableCapsule
                table={c}
                onExpand={() => handleExpandItem(c.id || i)}
              />
            )}
          </motion.div>
        ))}

        <AnimatePresence initial={false}>
          {showAllCards && children && (
            <motion.div
              key="expanded-content"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 28 }}
              style={{ overflow: 'hidden' }}
            >
              <div className="collapsible-content-inner" style={{ padding: '4px 0' }}>
                {children}
              </div>
            </motion.div>
          )}

          {showSingleItem && renderExpandedItem && (
            <motion.div
              key={`expanded-item-${activeItemId}`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              style={{ overflow: 'hidden' }}
            >
              {renderExpandedItem(activeItem)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
