// src/components/poker-table/poker-table.js
import { emitOpenSeatModal as openSeatModal } from '../../utils/modalBridge.js';
import { openDealerModal } from '../dealer-modal/dealer-modal.js';

const seatLayouts = {
  6: [
    { x: 0.55, y: -0.62 },
    { x: 0.79, y: 0.15 },
    { x: 0.35, y: 0.65 },
    { x: -0.35, y: 0.65 },
    { x: -0.79, y: 0.15 },
    { x: -0.55, y: -0.62 }
  ],
  8: [
    { x: 0.45, y: -0.65 },
    { x: 0.78, y: -0.20 },
    { x: 0.70, y: 0.45 },
    { x: 0.25, y: 0.66 },
    { x: -0.25, y: 0.66 },
    { x: -0.70, y: 0.45 },
    { x: -0.78, y: -0.20 },
    { x: -0.45, y: -0.65 }
  ],
  9: [
    { x: 0.45, y: -0.65 },
    { x: 0.77, y: -0.28 },
    { x: 0.75, y: 0.30 },
    { x: 0.42, y: 0.65 },
    { x: 0.00, y: 0.66 },
    { x: -0.42, y: 0.65 },
    { x: -0.75, y: 0.30 },
    { x: -0.77, y: -0.28 },
    { x: -0.45, y: -0.65 }
  ]
};

// ────────────────────────── utils base ──────────────────────────
function normalizeArgs(a, b) {
  const looksLikeTable = a && (a.gameType || a.status || a.smallBlind != null || a.bigBlind != null);
  const looksLikeSeats = a && typeof a === 'object' && (('seat_1' in a) || ('seat_2' in a) || ('seat_3' in a));
  if (looksLikeTable) return { tableData: a || {}, seatsData: b || {} };
  if (looksLikeSeats) return { tableData: b || {}, seatsData: a || {} };
  return { tableData: b || {}, seatsData: a || {} };
}

function ensureContainerReady(el, cb, tries = 0) {
  const w = el.clientWidth;
  const h = el.clientHeight;
  if (w >= 300 && h >= 300) return cb(w, h);
  if (tries > 20) return cb(w || 800, h || 500);
  requestAnimationFrame(() => ensureContainerReady(el, cb, tries + 1));
}

function msToHMS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// ─────────────────────── efectos visuales ───────────────────────
const _sparkTimers = new WeakMap();
let _dealerFlipTimer = null;
let _liveClockTimer = null;

function scheduleRandomSheenFor(el) {
  const prev = _sparkTimers.get(el);
  if (prev) clearTimeout(prev);

  const fire = () => {
    if (!document.body.contains(el)) return;
    el.classList.add('auto-sheen');
    setTimeout(() => el.classList.remove('auto-sheen'), 1600);
    const next = 2000 + Math.random() * 6000;
    const t = setTimeout(fire, next);
    _sparkTimers.set(el, t);
  };

  const startIn = 500 + Math.random() * 2500;
  const t0 = setTimeout(fire, startIn);
  _sparkTimers.set(el, t0);
}

function startRandomSeatSparks(container) {
  container.querySelectorAll('.player-seat.occupied').forEach(scheduleRandomSheenFor);
}
function stopRandomSeatSparks(container) {
  container.querySelectorAll('.player-seat').forEach(el => {
    const t = _sparkTimers.get(el);
    if (t) clearTimeout(t);
    el.classList.remove('auto-sheen');
  });
}

function startLiveClockTick() {
  if (_liveClockTimer) return;
  _liveClockTimer = setInterval(() => {
    const now = Date.now();
    document.querySelectorAll('.seat-timer').forEach(el => {
      const occupied = el.dataset.occupied === '1';
      if (!occupied) { el.textContent = ''; return; }
      const paused = el.dataset.paused === '1';
      if (paused) {
        const base = Number(el.dataset.ptTotal || 0);
        el.textContent = msToHMS(base);
        return;
      }
      const base = Number(el.dataset.ptTotal || 0);
      const last = Number(el.dataset.ptLast || now);
      const live = base + Math.max(0, now - last);
      el.textContent = msToHMS(live);
    });
  }, 1000);
}
function stopLiveClockTick() {
  if (_liveClockTimer) {
    clearInterval(_liveClockTimer);
    _liveClockTimer = null;
  }
}

// ─────────────────────── tooltip flotante ───────────────────────
let _activeTooltip = null;

function showSeatTooltip(seatEl, { name, chips, seatInfo }) {
  if (_activeTooltip) {
    _activeTooltip.remove();
    _activeTooltip = null;
  }

  const ptTotal = Number(seatInfo?.playTime?.totalMs || 0);
  const ptLast = Number(seatInfo?.playTime?.lastTick || Date.now());
  const ptPaused = !!seatInfo?.playTime?.paused;
  const elapsed = ptPaused ? ptTotal : ptTotal + Math.max(0, Date.now() - ptLast);

  const tip = document.createElement('div');
  tip.className = 'seat-tooltip-float';
  const totalSec = Math.floor(elapsed / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  const timeStr = h > 0 ? `${pad(h)} : ${pad(m)} : ${pad(s)}` : `${pad(m)} : ${pad(s)}`;
  tip.innerHTML = `
    <div class="stf-name">${name}</div>
    <div class="stf-chips">$${Number(chips).toLocaleString('es-MX')}</div>
    <div class="stf-time">${timeStr}</div>
    <div class="stf-hint">Mantén presionado para ver ficha</div>
  `;

  const rect = seatEl.getBoundingClientRect();
  tip.style.cssText = `
    position: fixed;
    left: ${rect.left + rect.width / 2}px;
    top: ${rect.top - 8}px;
    transform: translate(-50%, -100%);
    background: rgba(10,14,22,.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,.18);
    border-radius: 12px;
    padding: 10px 14px;
    color: #fff;
    font-size: 13px;
    font-weight: 500;
    text-align: center;
    z-index: 8000;
    pointer-events: none;
    box-shadow: 0 8px 24px rgba(0,0,0,.45);
    min-width: 120px;
  `;

  document.body.appendChild(tip);
  _activeTooltip = tip;

  // Auto-cerrar después de 2.5 segundos
  setTimeout(() => {
    if (_activeTooltip === tip) {
      tip.style.opacity = '0';
      tip.style.transition = 'opacity .2s ease';
      setTimeout(() => {
        tip.remove();
        if (_activeTooltip === tip) _activeTooltip = null;
      }, 200);
    }
  }, 2500);

  // Cerrar al tocar cualquier otro lado
  const closeOnOutside = (e) => {
    if (!seatEl.contains(e.target)) {
      tip.remove();
      if (_activeTooltip === tip) _activeTooltip = null;
      document.removeEventListener('pointerdown', closeOnOutside);
    }
  };
  setTimeout(() => document.addEventListener('pointerdown', closeOnOutside), 100);
}

// ── Watcher de urgencia de ausencia ──────────────────────────
let _absenceWatcher = null;

function startAbsenceWatcher(tableEl, maxMinutes) {
  if (_absenceWatcher) { clearInterval(_absenceWatcher); }
  const maxMs = (maxMinutes || 15) * 60 * 1000;
  _absenceWatcher = setInterval(() => {
    tableEl.querySelectorAll('.absence-ring[data-since]').forEach(ring => {
      const since = Number(ring.dataset.since || 0);
      if (!since) return;
      const elapsed = Date.now() - since;
      const chip = ring.closest('[data-seat-id]');
      if (elapsed >= maxMs) {
        chip?.classList.add('is-urgent');
      }
    });
  }, 5000);
}
// ─────────────────────── render principal ───────────────────────
export function renderTable(a, b) {
  const { tableData, seatsData } = normalizeArgs(a, b);

  const pokerTableEl = document.querySelector('.poker-table');
  if (!pokerTableEl) return;

  const cs = getComputedStyle(pokerTableEl);
  if (cs.position === 'static') pokerTableEl.style.position = 'relative';

  ensureContainerReady(pokerTableEl, (width, height) => {
    // Limpia timers/efectos previos
    stopRandomSeatSparks(pokerTableEl);
    if (_dealerFlipTimer) { clearTimeout(_dealerFlipTimer); _dealerFlipTimer = null; }

    // Limpia contenido previo
    pokerTableEl.querySelectorAll('.player-seat, .dealer-seat, .table-logo').forEach(el => el.remove());

    // Logo único
    const logo = document.createElement('div');
    logo.className = 'table-logo';
    logo.innerHTML = `<img src="/casino-logo.png" alt="Logo del Casino">`;
    pokerTableEl.appendChild(logo);

    // Dealer
    const dealerSeatEl = document.createElement('div');
    dealerSeatEl.className = 'seat dealer-seat';
    dealerSeatEl.style.zIndex = '2';
    const dealerImg = tableData?.dealerAvatar || '/dealers/dealer1.png';
    dealerSeatEl.innerHTML = `
      <div class="dealer-card" aria-label="Croupier">
        <div class="dealer-card__inner">
          <div class="dealer-card__face dealer-card__front">
            <img src="${dealerImg}" alt="Croupier" />
          </div>
          <div class="dealer-card__face dealer-card__back">
            <div class="dealer-card__back-inner">
              <img src="/casino-logo.png" alt="Logo del casino" />
            </div>
          </div>
        </div>
      </div>
    `;
    dealerSeatEl.addEventListener('click', openDealerModal);
    pokerTableEl.appendChild(dealerSeatEl);

    // Auto-flip del dealer
    const inner = dealerSeatEl.querySelector('.dealer-card__inner');
    let showingFront = true;
    const scheduleNextFlip = () => {
      if (_dealerFlipTimer) clearTimeout(_dealerFlipTimer);
      const stayMs = showingFront ? 6000 : 2200;
      _dealerFlipTimer = setTimeout(() => {
        showingFront = !showingFront;
        inner.classList.toggle('is-flipped', !showingFront);
        scheduleNextFlip();
      }, stayMs);
    };
    scheduleNextFlip();
    dealerSeatEl.addEventListener('mouseenter', () => { if (_dealerFlipTimer) clearTimeout(_dealerFlipTimer); });
    dealerSeatEl.addEventListener('mouseleave', () => scheduleNextFlip());

    // Radios elípticos
    const tableWidth = Math.max(width, 600);
    const tableHeight = Math.max(height, 380);
    const hRadius = tableWidth / 2 + 50;
    const vRadius = tableHeight / 2 + 50;

    // Asientos
    const maxSeats = Number(tableData?.maxSeats) || 9;
    const currentLayout = seatLayouts[maxSeats] || seatLayouts[9];

    for (let i = 0; i < currentLayout.length; i++) {
      const pos = currentLayout[i];
      let x = hRadius * pos.x;
      let y = vRadius * pos.y;
      if (!Number.isFinite(x)) x = 0;
      if (!Number.isFinite(y)) y = 0;

      const seatId = `seat_${i + 1}`;
      const seatInfo = seatsData?.[seatId] || { status: 'empty', seatNumber: i + 1 };

      const st = String(seatInfo?.status || 'empty').toLowerCase();
      const isOccupied =
        (st !== 'empty' && st !== 'available') ||
        !!(seatInfo?.name || seatInfo?.playerName || seatInfo?.player?.name) ||
        Number(seatInfo?.chips ?? seatInfo?.player?.chips ?? 0) > 0;

      const name = seatInfo?.player?.name || seatInfo?.playerName || seatInfo?.name || 'Jugador';
      const chips = Number(seatInfo?.player?.chips ?? seatInfo?.chips ?? 0);
      const avatar = seatInfo?.player?.avatar || seatInfo?.avatarUrl || seatInfo?.avatarURL || '/avatars/default.png';

      const seatEl = document.createElement('div');
      seatEl.dataset.seatId = seatId;
      seatEl.style.position = 'absolute';
      seatEl.style.left = '50%';
      seatEl.style.top = '50%';
      seatEl.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
      seatEl.style.zIndex = '2';

      if (isOccupied) {
        seatEl.className = 'seat player-seat occupied';

        const isAbsent = !!seatInfo?.absent;
        const absentSince = Number(seatInfo?.absentSince || 0);

        seatEl.innerHTML = `
  <div class="seat-chip full-avatar ${isAbsent ? 'is-absent' : ''}" aria-label="${name}">
    <img class="seat-avatar-full" src="${avatar}" alt="${name}">
  </div>
  ${isAbsent ? `<div class="absence-ring" data-since="${absentSince}"></div>` : ''}
`;

        // ── Long press = tarjeta completa | Click corto = tooltip ──
        let pressTimer = null;
        let didLongPress = false;

        seatEl.addEventListener('pointerdown', () => {
          didLongPress = false;
          pressTimer = setTimeout(() => {
            didLongPress = true;
            // Cerrar tooltip si estaba abierto
            if (_activeTooltip) { _activeTooltip.remove(); _activeTooltip = null; }
            window.dispatchEvent(new CustomEvent('open-player-card', {
              detail: { seatId, seatInfo: { ...seatInfo, name, chips, avatar } }
            }));
          }, 400);
        });

        seatEl.addEventListener('pointerup', () => {
          clearTimeout(pressTimer);
        });

        seatEl.addEventListener('pointercancel', () => {
          clearTimeout(pressTimer);
        });

        seatEl.addEventListener('click', () => {
          if (didLongPress) return;
          showSeatTooltip(seatEl, { name, chips, seatInfo });
        });

      } else {
        seatEl.className = 'seat player-seat available';
        seatEl.innerHTML = `
          <div class="available-circle"></div>
          <div class="seat-timer" data-seat="${seatId}" data-occupied="0"></div>
        `;
        seatEl.addEventListener('click', () => openSeatModal(seatId, seatInfo, { maxSeats }));
      }

      // Badge número de asiento
      const badge = document.createElement('span');
      badge.className = 'seat-badge';
      badge.textContent = String(i + 1);
      seatEl.appendChild(badge);

      pokerTableEl.appendChild(seatEl);
    }

    // Efectos y clock en vivo
    startRandomSeatSparks(pokerTableEl);
    startLiveClockTick();
  });
}

// Export opcional por si desmontas la vista
export function destroyTableView() {
  stopRandomSeatSparks(document.querySelector('.poker-table') || document.body);
  stopLiveClockTick();
}