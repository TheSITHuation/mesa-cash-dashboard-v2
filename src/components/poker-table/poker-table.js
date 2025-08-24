// src/components/poker-table/poker-table.js
import { openModal as openSeatModal } from '../seat-modal/seat-modal.js';
import { openDealerModal } from '../dealer-modal/dealer-modal.js';
import { openPlayerCard } from '../player-card/player-card.js';

const seatPositions = [
  { x:  0.45, y: -0.65 },
  { x:  0.77, y: -0.28 },
  { x:  0.75, y:  0.30 },
  { x:  0.42, y:  0.65 },
  { x:  0.00, y:  0.66 },
  { x: -0.42, y:  0.65 },
  { x: -0.75, y:  0.30 },
  { x: -0.77, y: -0.28 },
  { x: -0.45, y: -0.65 }
];

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

    // Auto-flip con sesgo a la cara del dealer (y limpieza en re-render)
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
    const tableWidth  = Math.max(width, 600);
    const tableHeight = Math.max(height, 380);
    const hRadius = tableWidth / 2 + 50;
    const vRadius = tableHeight / 2 + 50;

    // Asientos (mapa esperado: seatsData['seat_1'] …)
    for (let i = 0; i < seatPositions.length; i++) {
      const pos = seatPositions[i];
      let x = hRadius * pos.x;
      let y = vRadius * pos.y;
      if (!Number.isFinite(x)) x = 0;
      if (!Number.isFinite(y)) y = 0;

      const seatId = `seat_${i + 1}`;
      const seatInfo = seatsData?.[seatId] || { status: 'empty', seatNumber: i + 1 };

      const st = String(seatInfo?.status || 'empty').toLowerCase();
      const isOccupied = st !== 'empty' && st !== 'available'
                      || !!(seatInfo?.name || seatInfo?.playerName || seatInfo?.player?.name)
                      || Number(seatInfo?.chips ?? seatInfo?.player?.chips ?? 0) > 0;

      const name   = seatInfo?.player?.name || seatInfo?.playerName || seatInfo?.name || 'Jugador';
      const chips  = Number(seatInfo?.player?.chips ?? seatInfo?.chips ?? 0);
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
        const ptTotal = Number(seatInfo?.playTime?.totalMs || 0);
        const ptLast  = Number(seatInfo?.playTime?.lastTick || Date.now());

        seatEl.innerHTML = `
    <div class="seat-chip full-avatar" aria-label="${name}">
      <img class="seat-avatar-full" src="${avatar}" alt="${name}">
    </div>
    <div class="seat-tooltip" role="tooltip" aria-hidden="true">
      <strong>${name}</strong>
      <span>$ ${chips.toLocaleString?.() ?? chips}</span>
          </div>
        `;
        seatEl.addEventListener('click', () =>
          openPlayerCard(seatId, { ...seatInfo, name, chips, avatar })
        );
      } else {
        seatEl.className = 'seat player-seat available';
        seatEl.innerHTML = `
          <div class="available-circle"></div>
          <div class="seat-timer" data-seat="${seatId}" data-occupied="0"></div>
        `;
        seatEl.addEventListener('click', () => openSeatModal(seatId, seatInfo));
      }

      // badge número
      const badge = document.createElement('span');
      badge.className = 'seat-badge';
      badge.textContent = String(i + 1);
      seatEl.appendChild(badge);

      pokerTableEl.appendChild(seatEl);
    }

    // efectos y clock en vivo
    startRandomSeatSparks(pokerTableEl);
    startLiveClockTick();
  });
}

// Export opcional por si desmontas la vista
export function destroyTableView() {
  stopRandomSeatSparks(document.querySelector('.poker-table') || document.body);
  stopLiveClockTick();
}
