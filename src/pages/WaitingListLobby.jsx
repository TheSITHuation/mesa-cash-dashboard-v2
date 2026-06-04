import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../services/config/firebaseConfig.js';
import { AnimatePresence, motion } from 'framer-motion';

// ——— suit + color config por juego ———
const GAME_CONFIG = {
  NLHE: { suit: '♠', color: '#4a9eff', name: 'NLHE' },
  PLO:  { suit: '♦', color: '#a855f7', name: 'PLO'  },
  DCH:  { suit: '♣', color: '#22c55e', name: 'DCH'  },
  MAA:  { suit: '♥', color: '#f97316', name: 'MAA'  },
  'V&V':{ suit: '♥', color: '#f43f5e', name: 'V&V'  },
};

// Color for position numbers per game type
const POS_COLORS = {
  NLHE: '#4a9eff',
  PLO:  '#a855f7',
  DCH:  '#22c55e',
  MAA:  '#f97316',
  'V&V':'#f43f5e',
};

function gameConf(gt) {
  const key = gt?.toUpperCase();
  return GAME_CONFIG[key] || { suit: '♠', color: '#4a9eff', name: gt || 'NLHE' };
}

function posColor(gt) {
  const key = gt?.toUpperCase();
  return POS_COLORS[key] || '#4a9eff';
}

const MONTHS = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
const DAYS   = ['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'];

function fmtDate(d) {
  return `${DAYS[d.getDay()]}, ${d.getDate()} DE ${MONTHS[d.getMonth()]} DE ${d.getFullYear()}`;
}

function fmtClock(d) {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2,'0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function makeKey(gt, sb, bb) {
  return `${gt || 'NLHE'} ${Number(sb || 0)}/${Number(bb || 0)}`;
}

function fmtNum(n) {
  return Number(n).toLocaleString('es-MX');
}

export default function WaitingListLobby() {
  const [waitingList, setWaitingList] = useState([]);
  const [tables, setTables]           = useState([]);
  const [seatMap, setSeatMap]         = useState({});
  const [clock, setClock]             = useState(new Date());

  // override #app max-width/padding for full-bleed layout
  useEffect(() => {
    const s = document.createElement('style');
    s.textContent = [
      '#app{max-width:100%!important;padding:0!important;margin:0!important}',
      '@keyframes pulseCardGold{0%{box-shadow:0 0 15px rgba(251,191,36,.18),0 0 40px rgba(251,191,36,.08),0 0 70px rgba(251,191,36,.04)}50%{box-shadow:0 0 25px rgba(251,191,36,.35),0 0 60px rgba(251,191,36,.18),0 0 100px rgba(251,191,36,.07)}100%{box-shadow:0 0 15px rgba(251,191,36,.18),0 0 40px rgba(251,191,36,.08),0 0 70px rgba(251,191,36,.04)}}',
      '@keyframes glowBadge{0%,100%{opacity:1}50%{opacity:.6}}',
      '@keyframes bellRing{0%{transform:rotate(0deg)}5%{transform:rotate(14deg)}10%{transform:rotate(-11deg)}15%{transform:rotate(8deg)}20%{transform:rotate(-5deg)}25%{transform:rotate(3deg)}30%{transform:rotate(-1deg)}35%{transform:rotate(0deg)}100%{transform:rotate(0deg)}}',
    ].join('');

    document.head.appendChild(s);
    return () => s.remove();
  }, []);

  // live clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const seatUnsubs = useRef({});

  // waiting list
  useEffect(() => {
    const q = query(collection(db, 'generalWaitingList'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => {
      const data = [];
      snap.forEach(d => data.push({ id: d.id, ...d.data() }));
      setWaitingList(data);
    }, (err) => {
      if (err.code !== 'permission-denied') console.error('[WLL]', err);
    });
  }, []);

  // mesas activas / en espera
  useEffect(() => {
    const q = query(collection(db, 'tables'), where('publicLobby', '==', true));
    return onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach(d => {
        const data = d.data();
        const st = String(data.status || '').toLowerCase();
        if (st !== 'inactive' && st !== 'inactiva') list.push({ id: d.id, ...data });
      });
      setTables(list);
    });
  }, []);

  // asientos por mesa
  useEffect(() => {
    const currentIds = new Set(tables.map(t => t.id));
    Object.keys(seatUnsubs.current).forEach(id => {
      if (!currentIds.has(id)) { seatUnsubs.current[id](); delete seatUnsubs.current[id]; }
    });
    tables.forEach(t => {
      if (!seatUnsubs.current[t.id]) {
        seatUnsubs.current[t.id] = onSnapshot(collection(db, 'tables', t.id, 'seats'), (qsnap) => {
          let total = 0, occupied = 0;
          qsnap.forEach(d => {
            total++;
            const s = d.data() || {};
            const st = String(s.status || 'available').toLowerCase();
            const isOcc = st === 'occupied' || !!(s.name || s.playerName || s.player?.name) || Number(s.chips || 0) > 0;
            if (isOcc) occupied++;
          });
          total = Math.max(total, Number(t.maxSeats || 9));
          setSeatMap(prev => ({ ...prev, [t.id]: { occupied, total } }));
        });
      }
    });
    return () => { Object.values(seatUnsubs.current).forEach(u => u()); seatUnsubs.current = {}; };
  }, [tables]);

  // ——— agrupar ———
  const groups = useMemo(() => {
    const map = {};
    tables.forEach(t => {
      const key = makeKey(t.gameType, t.smallBlind, t.bigBlind);
      if (!map[key]) map[key] = { tables: [], waitingList: [], gameType: t.gameType, sb: t.smallBlind, bb: t.bigBlind };
      map[key].tables.push(t);
    });
    waitingList.forEach(w => {
      const key = makeKey(w.gameType, w.smallBlind, w.bigBlind);
      if (map[key]) map[key].waitingList.push(w);
    });
    return Object.entries(map)
      .map(([key, data]) => ({
        key,
        ...data,
        waitingList: data.waitingList.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0)),
      }))
      .sort((a, b) => b.waitingList.length - a.waitingList.length);
  }, [tables, waitingList]);

  // mesas con asiento libre (solo activas, no en-espera)
  const freeSeatTables = useMemo(() => {
    return tables.filter(t => {
      const st = String(t.status || '').toLowerCase();
      if (st !== 'active' && st !== 'activa') return false;
      const si = seatMap[t.id] || { occupied: 0, total: Number(t.maxSeats || 9) };
      return si.occupied < si.total;
    });
  }, [tables, seatMap]);

  return (
    <div style={S.root}>
      {/* ambient glow */}
      <div style={S.ambient} />

      {/* ─── HEADER ─── */}
      <header style={S.header}>
        {/* Left label */}
        <div style={S.headerLeft}>
          <div style={S.headerLabel}>
            <span style={S.headerLabelDot}>♠</span>
            LISTA DE ESPERA
          </div>
        </div>

        {/* Center: date */}
        <div style={S.headerCenter}>
          <div style={S.headerDash} />
          <span style={S.date}>{fmtDate(clock)}</span>
          <div style={S.headerDash} />
        </div>

        {/* Right: logo */}
        <div style={S.headerRight}>
          <img src="/branding/logo.png" alt="" style={S.logo} />
        </div>
      </header>

      {/* ─── DASHBOARD ─── */}
      {groups.length === 0 ? (
        <div style={S.empty}>
          <div style={{ fontSize: 64, opacity: .06, marginBottom: 20 }}>♠</div>
          <div style={S.emptyT}>NO HAY JUGADORES EN ESPERA</div>
        </div>
      ) : (
        <div style={S.dash}>
          {groups.map(({ key, tables: grpTables, waitingList: items, gameType }) => {
            const [gt, blinds] = key.split(' ');
            const [sb, bb]     = blinds.split('/').map(Number);
            const cfg          = gameConf(gt);
            const pColor       = posColor(gt);

            const freeInGroup = freeSeatTables.filter(t => {
              const mg = (t.gameType || '').toUpperCase() === gt.toUpperCase();
              const mb = Number(t.smallBlind) === sb && Number(t.bigBlind) === bb;
              return mg && mb;
            });

            let totalSeats = 0, occupiedSeats = 0;
            let activeCount = 0, esperaCount = 0;
            grpTables.forEach(t => {
              const st = String(t.status || '').toLowerCase();
              if (st === 'active' || st === 'activa') activeCount++;
              else if (st === 'en-espera') esperaCount++;
              const si = seatMap[t.id] || { occupied: 0, total: Number(t.maxSeats || 9) };
              totalSeats   += si.total;
              occupiedSeats += si.occupied;
            });
            const freeSeatCount   = totalSeats - occupiedSeats;
            const tableCount      = grpTables.length;
            const canCreateTable  = items.length >= 6;

            // buy-in range
            const mins   = grpTables.map(t => Number(t.minBuyIn || 0));
            const maxs   = grpTables.map(t => Number(t.maxBuyIn || 0));
            const minVal = Math.min(...mins);
            const maxVal = Math.max(...maxs);

            return (
              <div key={key} style={{
                ...S.card,
                ...(canCreateTable ? {
                  borderColor: '#fbbf24',
                  boxShadow: `
                    0 0 30px rgba(251,191,36,.35),
                    0 0 60px rgba(251,191,36,.18),
                    0 0 90px rgba(251,191,36,.08),
                    0 4px 32px rgba(0,0,0,.35),
                    inset 0 1px 0 rgba(255,255,255,.1)
                  `,
                  animation: 'pulseCardGold 1.5s ease-in-out infinite',
                } : {}),
              }}>

                {/* ── GAME HEADER ── */}
                <div style={S.gameHeader}>
                  <div style={S.gameRow}>
                    <span style={{ ...S.suit, color: cfg.color }}>{cfg.suit}</span>
                    <span style={{ ...S.gameTitle, color: '#ffffff' }}>{cfg.name} {sb}/{bb}</span>
                  </div>
                  <span style={{ ...S.buyinRange, color: cfg.color }}>
                    {fmtNum(minVal)}/{fmtNum(maxVal)}
                  </span>
                </div>

                {/* ── OPENING BADGE ── */}
                {canCreateTable && (
                  <div style={{ ...S.openBadge, backgroundColor: 'rgba(251,191,36,.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,.4)', animation: 'glowBadge 1.5s ease-in-out infinite' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 20, height: 20, flexShrink: 0, transformOrigin: '12px 3px', animation: 'bellRing 2.5s ease-in-out infinite' }}>
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    Abriendo Mesa Nueva...
                  </div>
                )}

                {/* ── DIVIDER ── */}
                <div style={S.divider} />

                {/* ── MESAS ROW ── */}
                <div style={S.mesasRow}>
                  <span style={S.chairIcon}>🪑</span>
                  {activeCount > 0 ? (
                    <>
                      <span style={S.mesasLabel}>MESAS ACTIVAS</span>
                      <span style={{ ...S.mesasCount, backgroundColor: cfg.color + '22', color: cfg.color, border: `1px solid ${cfg.color}44` }}>
                        {activeCount}
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={S.mesasLabel}>EN FORMACIÓN</span>
                      <span style={{ ...S.mesasCount, backgroundColor: '#fbbf24' + '22', color: '#fbbf24', border: '1px solid #fbbf2444' }}>
                        {esperaCount}
                      </span>
                    </>
                  )}
                  {esperaCount > 0 && activeCount > 0 && (
                    <span style={{ ...S.mesasCount, backgroundColor: '#fbbf24' + '22', color: '#fbbf24', border: '1px solid #fbbf2444' }}>
                      {esperaCount} esp.
                    </span>
                  )}
                </div>

                {/* ── SEAT AVAILABILITY ── */}
                {activeCount > 0 ? (
                  freeInGroup.length > 0 ? (
                    <div style={S.availBanner}>
                      <div style={S.availGlow} />
                      <span style={S.availChair}>🪑</span>
                      <div style={S.availTextBlock}>
                        <span style={S.availMesa}>
                          MESA {freeInGroup[0].slotNumber || freeInGroup[0].name?.replace('Table-', '') || ''}
                        </span>
                        <span style={S.availSub}>ASIENTO DISPONIBLE</span>
                      </div>
                      <div style={S.availArrow}>›</div>
                    </div>
                  ) : (
                    <div style={S.noAvail}>
                      <span style={S.noAvailCheck}>✓</span>
                      NO HAY ASIENTOS DISPONIBLES
                    </div>
                  )
                ) : (
                  <div style={S.noAvail}>
                    <span style={S.noAvailCheck}>⏳</span>
                    MESA EN FORMACIÓN
                  </div>
                )}

                {/* ── PLAYER LIST ── */}
                <div style={S.listWrap}>
                  {items.length === 0 ? (
                    <div style={S.listEmpty}>SIN JUGADORES EN ESPERA</div>
                  ) : (
                    <AnimatePresence initial={false}>
                      {items.map((item, i) => (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, x: -16, height: 0 }}
                          animate={{ opacity: 1, x: 0,  height: 'auto' }}
                          exit={{ opacity: 0, x: 16,  height: 0 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                          style={{
                            ...S.playerRow,
                            background: i % 2 === 1 ? 'rgba(255,255,255,.018)' : 'transparent',
                          }}
                        >
                          <span style={{ ...S.pos, color: pColor }}>{i + 1}</span>
                          <span style={S.pName}>{item.name || '?'}</span>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}


    </div>
  );
}

// ─── STYLES ───
const S = {
  root: {
    minHeight: '100vh',
    background: '#080c14',
    position: 'relative',
    overflowX: 'hidden',
    fontFamily: "'Inter', 'SF Pro Display', system-ui, -apple-system, sans-serif",
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
  },

  ambient: {
    position: 'fixed', inset: 0,
    background: `
      radial-gradient(ellipse 80% 30% at 50% 0%, rgba(20,60,130,.18), transparent 55%),
      radial-gradient(ellipse 50% 40% at 10% 70%, rgba(74,158,255,.04), transparent 55%),
      radial-gradient(ellipse 40% 30% at 90% 30%, rgba(74,158,255,.04), transparent 50%)
    `,
    pointerEvents: 'none', zIndex: 0,
  },

  // ─── HEADER ───
  header: {
    position: 'relative', zIndex: 2,
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 28px 10px',
    borderBottom: '1px solid rgba(255,255,255,.06)',
    marginBottom: 0,
  },
  headerLeft: { flex: '0 0 auto' },
  headerLabel: {
    display: 'flex', alignItems: 'center', gap: 7,
    fontSize: 11, fontWeight: 700, letterSpacing: '2px',
    color: 'rgba(255,255,255,.3)',
    background: 'rgba(255,255,255,.05)',
    border: '1px solid rgba(255,255,255,.08)',
    borderRadius: 8,
    padding: '5px 12px',
    textTransform: 'uppercase',
  },
  headerLabelDot: { fontSize: 13, color: 'rgba(255,255,255,.25)' },
  headerCenter: {
    flex: '1 1 auto',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 20,
  },
  headerDash: {
    height: 1, width: 120,
    background: 'linear-gradient(90deg, transparent, rgba(212,175,55,.35), transparent)',
  },
  date: {
    fontSize: 28, fontWeight: 700, letterSpacing: '2px',
    color: 'rgba(255,255,255,.88)',
    textTransform: 'uppercase', whiteSpace: 'nowrap',
  },
  headerRight: { flex: '0 0 auto' },
  logo: {
    height: 46, objectFit: 'contain',
    filter: 'drop-shadow(0 0 14px rgba(74,158,255,.15))',
    opacity: .9,
  },

  // ─── EMPTY ───
  empty: {
    position: 'relative', zIndex: 1,
    flex: 1, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    textAlign: 'center',
  },
  emptyT: {
    fontSize: 16, color: 'rgba(255,255,255,.12)',
    fontWeight: 700, letterSpacing: '3px',
  },

  // ─── DASHBOARD ───
  dash: {
    position: 'relative', zIndex: 1,
    display: 'flex', gap: 16,
    flex: 1,
    padding: '16px 20px 20px',
    alignItems: 'stretch',
  },

  // ─── CARD ───
  card: {
    flex: 1,
    minWidth: 220,
    background: 'rgba(255,255,255,.04)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    borderRadius: 16,
    border: '1px solid rgba(255,255,255,.09)',
    boxShadow: '0 4px 32px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.07)',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },

  // ─── GAME HEADER ───
  gameHeader: {
    padding: '24px 20px 10px',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 6,
    textAlign: 'center',
  },
  gameRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  suit: {
    fontSize: 26, fontWeight: 400, lineHeight: 1,
  },
  gameTitle: {
    fontSize: 28, fontWeight: 800, letterSpacing: '-.3px', lineHeight: 1.1,
  },
  buyinRange: {
    fontSize: 18, fontWeight: 700, letterSpacing: '.5px',
    opacity: 1,
  },

  // ─── OPEN BADGE ───
  openBadge: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    margin: '0 auto',
    padding: '5px 16px', borderRadius: 100,
    fontSize: 12, fontWeight: 700, letterSpacing: '.5px',
    whiteSpace: 'nowrap',
  },
  // ─── DIVIDER ───
  divider: {
    height: 1,
    background: 'rgba(255,255,255,.05)',
  },

  // ─── MESAS ROW ───
  mesasRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 20px',
    borderBottom: '1px solid rgba(255,255,255,.04)',
  },
  chairIcon: { fontSize: 14, opacity: .5 },
  mesasLabel: {
    flex: 1,
    fontSize: 10, fontWeight: 700, letterSpacing: '1.5px',
    color: 'rgba(255,255,255,.3)',
    textTransform: 'uppercase',
  },
  mesasCount: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 24, height: 22, borderRadius: 5, padding: '0 6px',
    fontSize: 13, fontWeight: 800,
  },

  // ─── AVAILABILITY ───
  availBanner: {
    margin: '8px 12px',
    padding: '11px 14px',
    borderRadius: 10,
    background: 'rgba(74,158,255,.1)',
    border: '1px solid rgba(74,158,255,.3)',
    display: 'flex', alignItems: 'center', gap: 10,
    position: 'relative', overflow: 'hidden',
    cursor: 'pointer',
  },
  availGlow: {
    position: 'absolute', inset: 0,
    background: 'radial-gradient(ellipse 70% 100% at 20% 50%, rgba(74,158,255,.12), transparent)',
    pointerEvents: 'none',
  },
  availChair: { fontSize: 20, flexShrink: 0, zIndex: 1 },
  availTextBlock: {
    display: 'flex', flexDirection: 'column', gap: 1, zIndex: 1,
    flex: 1,
  },
  availMesa: {
    fontSize: 15, fontWeight: 800, color: '#ffffff',
    letterSpacing: '.5px', lineHeight: 1.2,
  },
  availSub: {
    fontSize: 9, fontWeight: 700, color: 'rgba(74,158,255,.8)',
    letterSpacing: '1.5px', textTransform: 'uppercase',
  },
  availArrow: {
    fontSize: 22, color: 'rgba(74,158,255,.7)', zIndex: 1,
    fontWeight: 300, lineHeight: 1,
  },

  noAvail: {
    margin: '8px 12px',
    padding: '10px 14px',
    borderRadius: 10,
    background: 'rgba(255,255,255,.02)',
    border: '1px solid rgba(255,255,255,.05)',
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 10, fontWeight: 600,
    color: 'rgba(255,255,255,.22)',
    letterSpacing: '1.2px',
  },
  noAvailCheck: {
    fontSize: 14, color: 'rgba(100,220,130,.35)',
    fontWeight: 700, flexShrink: 0,
  },

  // ─── PLAYER LIST ───
  listWrap: { flex: 1, padding: '6px 0 10px' },
  listEmpty: {
    padding: '24px 20px', textAlign: 'center',
    fontSize: 11, color: 'rgba(255,255,255,.08)', letterSpacing: '1px',
  },
  playerRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '5px 20px',
  },
  pos: {
    width: 22, flexShrink: 0,
    fontSize: 14, fontWeight: 700,
    fontVariantNumeric: 'tabular-nums',
  },
  pName: {
    flex: 1, fontSize: 20, fontWeight: 300,
    color: 'rgba(255,255,255,.82)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    letterSpacing: '.3px',
  },

};
