// src/components/player-card/player-card.js
// Ficha de jugador (glass) + timer en vivo + cashout seguro + overlay estable

import './player-card.scss';
import { getTableId } from '../../utils/getTableId.js';
import { db } from '../../services/config/firebaseConfig.js';
import {
  doc,
  runTransaction,
  serverTimestamp,
  onSnapshot,
  deleteField,
} from 'firebase/firestore';
import { markPlayerAbsent, markPlayerReturned } from '../../services/firebase/absenceService.js';

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import TimerDisplay from '../timer-display/TimerDisplay.jsx';
import { showError } from '../ui/toast.js';

/* =================== Refs DOM =================== */
let modal,
  avatarEl,
  nameEl,
  totalAmountEl,
  purchasesCountEl,
  sessionLiveRoot,
  sessionTotalEl,
  accumulatedRowEl,
  buyinInput,
  rebuyBtn,
  cashoutBtn,
  cancelBtn;

let absentBtn = null;
let absenceTimerEl = null;
let chipsDisplayEl = null;
let absenceBarEl = null;

/* =================== Estado =================== */
let currentSeatId = null;
let tableIdOverride = null;
let currentChips = 0;
let currentPurchasesCount = 0;
let currentTotalAmount = 0;
let _unsubscribeSeat = null;
let _unsubscribeTable = null;
let _liveTimer = null;
let _tableActive = true;
let _absenceTimer = null;
let _isAbsent = false;
let _absentSince = 0;
let _maxAbsenceMinutes = 15;

// Session tracking for player timer
let _sessionStartMs = null;
let _sessionState = 'idle';
let _pausedTotalMs = 0;
let _pauseStartMs = null;
let _playerJoinedMs = null;

const USE_DELETE = false;

function isActiveStatus(s) {
  const v = String(s || '').toLowerCase();
  return v === 'active' || v === 'activa';
}

/* =================== Boot/Refs =================== */
function wireEvents() {
  if (cancelBtn && !cancelBtn._bound) { cancelBtn._bound = true; cancelBtn.onclick = onCancel; }
  if (absentBtn && !absentBtn._bound) { absentBtn._bound = true; absentBtn.onclick = onToggleAbsent; }
  if (rebuyBtn && !rebuyBtn._bound) { rebuyBtn._bound = true; rebuyBtn.onclick = onRebuy; }
  if (cashoutBtn && !cashoutBtn._bound) { cashoutBtn._bound = true; cashoutBtn.onclick = onCashout; }
  if (buyinInput) {
    buyinInput.setAttribute('inputmode', 'numeric');
    buyinInput.setAttribute('pattern', '[0-9]*');
    if (!buyinInput._bound) {
      buyinInput._bound = true;
      buyinInput.addEventListener('input', () => {
        buyinInput.value = (buyinInput.value || '').replace(/[^\d]/g, '');
      });
    }
  }
  if (!document._pcEscBound) {
    document._pcEscBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') onCancel();
    });
  }
}

function queryRefsFrom(mod) {
  avatarEl = mod.querySelector('#card-player-avatar');
  nameEl = mod.querySelector('#card-player-name');
  totalAmountEl = mod.querySelector('#card-total-amount');
  purchasesCountEl = mod.querySelector('#card-purchases-count');
  sessionLiveRoot = mod.querySelector('#card-player-session-live');
  sessionTotalEl = mod.querySelector('#card-player-session-total');
  accumulatedRowEl = mod.querySelector('#pc-row-accumulated');
  buyinInput = mod.querySelector('#card-rebuy-amount');
  rebuyBtn = mod.querySelector('#card-btn-rebuy');
  cashoutBtn = mod.querySelector('#card-btn-cashout');
  cancelBtn = mod.querySelector('#card-btn-cancel');
  absentBtn = mod.querySelector('#card-btn-absent');
  absenceTimerEl = mod.querySelector('#card-absence-timer');
  chipsDisplayEl = mod.querySelector('#card-chips-display');
  absenceBarEl = mod.querySelector('#card-absence-bar');

  // Mount React timer if not already mounted
  if (sessionLiveRoot && !sessionLiveRoot._timerRoot) {
    sessionLiveRoot._timerRoot = createRoot(sessionLiveRoot);
    sessionLiveRoot._timerRoot.render(createElement(TimerDisplay, { totalSeconds: 0, paused: true, compact: true }));
  }
}

function ensureModal() {
  let found =
    document.getElementById('player-card-modal') ||
    document.getElementById('player-card') ||
    document.querySelector('.player-card-modal') ||
    document.querySelector('.player-card');

  if (!found) {
    found = document.createElement('div');
    found.id = 'player-card-modal';
    found.className = 'player-card-modal';
    found.innerHTML = `
  <div class="pc-modal-glass">
    <div class="pc-modal-shine"></div>
    <div class="pc-modal-inner">
      <div class="pc-modal-header">
        <div class="pc-modal-avatar-wrap">
          <img id="card-player-avatar" src="/avatars/default.png" alt="">
          <div class="pc-modal-dot" id="card-status-dot"></div>
        </div>
        <div class="pc-modal-info">
          <div class="pc-modal-seat" id="card-seat-label">Asiento —</div>
          <div id="card-player-name">Jugador</div>
          <span class="pc-modal-badge" id="card-status-badge">
            <span class="pc-modal-badge-dot" id="card-badge-dot"></span>
            <span id="card-badge-text">En mesa</span>
          </span>
        </div>
      </div>
      <div class="pc-modal-sep"></div>
      <div class="pc-modal-stats">
        <div class="pc-modal-stat">
          <div class="pc-modal-stat-label">Stack</div>
          <div class="pc-modal-stat-value sv-gold" id="card-chips-display">$0</div>
        </div>
        <div class="pc-modal-stat">
          <div class="pc-modal-stat-label">Compras</div>
          <div class="pc-modal-stat-value sv-white" id="card-purchases-count">0</div>
        </div>
        <div class="pc-modal-stat">
          <div class="pc-modal-stat-label">Tiempo</div>
          <div class="pc-modal-stat-value sv-time" id="card-player-session-live">00:00</div>
        </div>
        <div class="pc-modal-stat">
          <div class="pc-modal-stat-label">Ingreso total</div>
          <div class="pc-modal-stat-value sv-gold" id="card-total-amount">$0</div>
        </div>
      </div>
      <div class="pc-modal-absence" id="card-absence-bar">
        <span class="pc-modal-absence-icon" aria-hidden="true">⏱</span>
        <span class="pc-modal-absence-label">Jugador ausente</span>
        <span id="card-absence-timer">00:00</span>
      </div>
      <div class="pc-modal-actions">
        <div class="pc-modal-row">
          <input id="card-rebuy-amount" type="number" placeholder="Monto Rebuy..." min="1">
          <button id="card-btn-rebuy" class="pc-modal-btn">+ Fichas</button>
        </div>
        <button id="card-btn-absent" class="pc-modal-btn">Marcar ausente</button>
        <button id="card-btn-cashout" class="pc-modal-btn">Cash Out</button>
        <button id="card-btn-cancel" class="pc-modal-btn">Cancelar</button>
      </div>
    </div>
  </div>
`;
  }

  if (!found.dataset.pcCleaned) {
    const clone = found.cloneNode(true);
    found.replaceWith(clone);
    found = clone;
    found.dataset.pcCleaned = '1';
  }

  if (found.parentElement !== document.body) document.body.appendChild(found);

  Object.assign(found.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '10000',
    display: 'none',
    placeItems: 'center',
    transform: 'none'
  });

  modal = found;
  queryRefsFrom(modal);
  wireEvents();
  return modal;
}

/* =================== API pública =================== */
export function initPlayerCard(tableId) {
  tableIdOverride = tableId || null;
  ensureModal();
}

export function openPlayerCard(seatId, data = {}) {
  currentSeatId = seatId || null;

  // auto-init si no llamaron initPlayerCard()
  if (!modal || !document.body.contains(modal)) ensureModal();

  // Reset visual — _isAbsent se sincroniza desde Firestore
  _isAbsent = false;
  _absentSince = 0;
  stopAbsenceCounter();

  // seed de datos para UX inmediata
  const name = data?.player?.name || data?.playerName || data?.name || 'Jugador';
  const chips = Number(data?.player?.chips ?? data?.chips ?? 0);
  const avatar = data?.player?.avatar || data?.avatarUrl || data?.avatarURL || data?.avatar || '/avatars/default.png';
  const status = String(data?.status || 'available').toLowerCase();
  const moves = Array.isArray(data?.movements) ? data.movements : [];

  if (avatarEl) avatarEl.src = avatar;
  if (nameEl) nameEl.textContent = name;
  setChips(chips);
  setPurchases(countPurchases(moves));
  setTotalAmount(totalPurchasesFrom(moves));
  if (cashoutBtn) cashoutBtn.disabled = !(chips > 0 && status === 'occupied');

  // Capture player join time from initial data
  const joinedAt = data?.joinedAt;
  if (joinedAt) {
    if (typeof joinedAt.toMillis === 'function') {
      _playerJoinedMs = joinedAt.toMillis();
    } else if (typeof joinedAt === 'number') {
      _playerJoinedMs = joinedAt;
    } else if (joinedAt.seconds) {
      _playerJoinedMs = joinedAt.seconds * 1000 + (joinedAt.nanoseconds || 0) / 1e6;
    }
  }

  const sessionMs = computePlayerSessionMs();
  if (sessionLiveRoot?._timerRoot) {
    sessionLiveRoot._timerRoot.render(createElement(TimerDisplay, {
      totalSeconds: Math.floor(sessionMs / 1000),
      paused: !_tableActive,
      compact: true
    }));
  }
  if (sessionTotalEl) sessionTotalEl.textContent = msToHMS(sessionMs);

  modal.classList.remove('hidden');
  modal.classList.add('is-open');
  modal.style.display = 'grid';
  document.body.classList.add('modal-open');

  subscribeTableStatus();
  subscribeSeatRealtime();
}

/* =================== Utils =================== */
function formatMoney(n) { return Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 }); }
function totalPurchasesFrom(moves) {
  return (Array.isArray(moves) ? moves : [])
    .filter(m => m && (m.type === 'buyin' || m.type === 'rebuy'))
    .reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
}
function countPurchases(moves) {
  return (Array.isArray(moves) ? moves : [])
    .filter(m => m && (m.type === 'buyin' || m.type === 'rebuy')).length;
}
function effectiveTableId() { return tableIdOverride || getTableId(); }
function setChips(n) {
  currentChips = Number(n) || 0;
  if (chipsDisplayEl) chipsDisplayEl.textContent = `$${formatMoney(currentChips)}`;
}
function setPurchases(n) {
  currentPurchasesCount = Number(n) || 0;
  if (purchasesCountEl) purchasesCountEl.textContent = String(currentPurchasesCount);
}
function setTotalAmount(n) {
  currentTotalAmount = Number(n) || 0;
  if (totalAmountEl) totalAmountEl.textContent = `$${formatMoney(currentTotalAmount)}`;
}
function msToHMS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (x) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/* =================== Timer UI =================== */
function startLiveTimer() {
  if (_liveTimer || !sessionLiveRoot?._timerRoot) return;
  _liveTimer = setInterval(() => {
    if (!_tableActive) return;
    const sessionMs = computePlayerSessionMs();
    sessionLiveRoot._timerRoot.render(createElement(TimerDisplay, {
      totalSeconds: Math.floor(sessionMs / 1000),
      paused: false,
      compact: true
    }));
  }, 1000);
}
function stopLiveTimer() { if (_liveTimer) { clearInterval(_liveTimer); _liveTimer = null; } }

/* =================== Estado de mesa =================== */
function computeSessionElapsedMs() {
  if (!_sessionStartMs) return 0;
  const startMs = _sessionStartMs;
  const pausedTotal = _pausedTotalMs || 0;

  let raw;
  if (_sessionState === 'running') {
    raw = Date.now() - startMs - pausedTotal;
  } else if (_sessionState === 'paused') {
    raw = (_pauseStartMs || Date.now()) - startMs - pausedTotal;
  } else {
    return 0;
  }
  return Math.max(0, raw);
}

function computePlayerSessionMs() {
  const sessionElapsed = computeSessionElapsedMs();
  if (!_playerJoinedMs) return sessionElapsed;

  const playerElapsed = Math.max(0, Date.now() - _playerJoinedMs);
  return Math.min(sessionElapsed, playerElapsed);
}

function subscribeTableStatus() {
  if (_unsubscribeTable) { _unsubscribeTable(); _unsubscribeTable = null; }
  const tableId = effectiveTableId();
  if (!tableId) return;
  const tableRef = doc(db, 'tables', tableId);
  _unsubscribeTable = onSnapshot(tableRef, (snap) => {
    const data = snap.exists() ? snap.data() : null;
    _tableActive = isActiveStatus(data?.status);
    _maxAbsenceMinutes = Number(data?.maxAbsenceMinutes || 15);

    // Capture session data
    const startAt = data?.sessionStartAt;
    if (startAt) {
      if (typeof startAt.toMillis === 'function') {
        _sessionStartMs = startAt.toMillis();
      } else if (typeof startAt === 'number') {
        _sessionStartMs = startAt;
      } else if (startAt.seconds) {
        _sessionStartMs = startAt.seconds * 1000 + (startAt.nanoseconds || 0) / 1e6;
      }
    }
    _sessionState = data?.sessionState || 'idle';
    _pausedTotalMs = Number(data?.pausedTotalMs || 0);
    const pauseStartAt = data?.pauseStartedAt;
    if (pauseStartAt) {
      if (typeof pauseStartAt.toMillis === 'function') {
        _pauseStartMs = pauseStartAt.toMillis();
      } else if (typeof pauseStartAt === 'number') {
        _pauseStartMs = pauseStartAt;
      } else if (pauseStartAt.seconds) {
        _pauseStartMs = pauseStartAt.seconds * 1000 + (pauseStartAt.nanoseconds || 0) / 1e6;
      }
    }

    if (sessionLiveRoot?._timerRoot) {
      const sessionMs = computePlayerSessionMs();
      sessionLiveRoot._timerRoot.render(createElement(TimerDisplay, {
        totalSeconds: Math.floor(sessionMs / 1000),
        paused: !_tableActive,
        compact: true
      }));
    }
    if (_tableActive) startLiveTimer();
  });
}

/* =================== Realtime seat =================== */
function subscribeSeatRealtime() {
  if (_unsubscribeSeat) { _unsubscribeSeat(); _unsubscribeSeat = null; }
  stopLiveTimer();
  const tableId = effectiveTableId();
  if (!tableId || !currentSeatId) return;

  const ref = doc(db, 'tables', tableId, 'seats', currentSeatId);
  _unsubscribeSeat = onSnapshot(ref, (snap) => {
    if (!snap.exists()) { onCancel(); return; }
    const seat = snap.data();
    const status = String(seat?.status || '').toLowerCase();
    const chips = Number(seat?.player?.chips ?? seat?.chips ?? 0);
    const hasName = !!(seat?.player?.name || seat?.playerName || seat?.name);
    const isOccupiedDoc = (status === 'occupied') || chips > 0 || hasName;

    if (!isOccupiedDoc) {
      if (cashoutBtn) cashoutBtn.disabled = true;
      _playerJoinedMs = null;
      if (sessionLiveRoot?._timerRoot) {
        sessionLiveRoot._timerRoot.render(createElement(TimerDisplay, {
          totalSeconds: 0,
          paused: true,
          compact: true
        }));
      }
      if (sessionTotalEl) sessionTotalEl.textContent = '00:00';
      return;
    }

    const name = seat?.player?.name || seat?.playerName || seat?.name || 'Jugador';
    const avatar = seat?.player?.avatar || seat?.avatarUrl || seat?.avatarURL || '/avatars/default.png';
    if (avatarEl) avatarEl.src = avatar;
    if (nameEl) nameEl.textContent = name;
    setChips(chips);
    const moves = Array.isArray(seat?.movements) ? seat.movements : [];
    setPurchases(countPurchases(moves));
    setTotalAmount(totalPurchasesFrom(moves));
    if (cashoutBtn) cashoutBtn.disabled = !(chips > 0);

    // Capture player join time for session calculation
    const joinedAt = seat?.joinedAt;
    if (joinedAt) {
      if (typeof joinedAt.toMillis === 'function') {
        _playerJoinedMs = joinedAt.toMillis();
      } else if (typeof joinedAt === 'number') {
        _playerJoinedMs = joinedAt;
      } else if (joinedAt.seconds) {
        _playerJoinedMs = joinedAt.seconds * 1000 + (joinedAt.nanoseconds || 0) / 1e6;
      }
    }

    const sessionMs = computePlayerSessionMs();
    if (sessionLiveRoot?._timerRoot) {
      sessionLiveRoot._timerRoot.render(createElement(TimerDisplay, {
        totalSeconds: Math.floor(sessionMs / 1000),
        paused: !_tableActive,
        compact: true
      }));
    }
    if (sessionTotalEl) sessionTotalEl.textContent = msToHMS(sessionMs);
    startLiveTimer();

    // ── Sincronizar ausencia desde Firestore ──────────────────
    const seatAbsent = !!seat?.absent;
    const seatAbsentSince = Number(seat?.absentSince || 0);

    if (seatAbsent && !_isAbsent) {
      // Jugador está ausente en Firebase — activar contador
      _isAbsent = true;
      _absentSince = seatAbsentSince;
      startAbsenceCounter(seatAbsentSince, _maxAbsenceMinutes);
    } else if (!seatAbsent && _isAbsent) {
      // Jugador regresó en Firebase — limpiar contador
      _isAbsent = false;
      _absentSince = 0;
      stopAbsenceCounter();
    }
    // ─────────────────────────────────────────────────────────
  }, (err) => {
    console.error('[player-card] onSnapshot error:', err);
  });
}

/* =================== Ausencia =================== */
function startAbsenceCounter(absentSince, maxMinutes) {
  if (_absenceTimer) { clearInterval(_absenceTimer); _absenceTimer = null; }
  if (!absenceTimerEl) return;
  if (absenceBarEl) absenceBarEl.classList.add('show');

  // Cache DOM lookups (called every 1s) — match design system tokens
  const badge = modal?.querySelector('#card-status-badge');
  const badgeText = modal?.querySelector('#card-badge-text');
  const dot = modal?.querySelector('#card-status-dot');
  const absenceBar = absenceBarEl;
  const absenceTimer = absenceTimerEl;
  const absentActionBtn = absentBtn;
  const urgent = {
    textColor: '#ff453a',                              /* state-danger-urgent */
    barBg: 'rgba(255, 69, 58, 0.08)',
    barBorder: 'rgba(255, 69, 58, 0.25)',
    badgeBg: 'rgba(255, 69, 58, 0.15)',
    badgeBorder: 'rgba(255, 69, 58, 0.3)',
    dotShadow: '0 0 8px #ff453a',
  };
  const warning = {
    textColor: '#ffd60a',                              /* state-warning */
    barBg: 'rgba(255, 214, 10, 0.07)',
    barBorder: 'rgba(255, 214, 10, 0.2)',
    badgeBg: 'rgba(255, 214, 10, 0.15)',
    badgeBorder: 'rgba(255, 214, 10, 0.3)',
    dotShadow: '0 0 8px #ffd60a',
  };

  const maxMs = (maxMinutes || 15) * 60 * 1000;
  const tick = () => {
    const elapsed = Date.now() - absentSince;
    const isUrgent = elapsed >= maxMs;
    const palette = isUrgent ? urgent : warning;
    absenceTimer.textContent = msToHMS(elapsed);
    absenceTimer.style.color = palette.textColor;
    if (absenceBar) {
      absenceBar.style.background = palette.barBg;
      absenceBar.style.borderColor = palette.barBorder;
    }
    if (isUrgent) {
      if (absentActionBtn) absentActionBtn.textContent = '⚠ De vuelta — URGENTE';
      if (badge) {
        badge.style.background = palette.badgeBg;
        badge.style.color = palette.textColor;
        badge.style.borderColor = palette.badgeBorder;
      }
      if (badgeText) badgeText.textContent = 'Ausente URGENTE';
      if (dot) {
        dot.style.background = palette.textColor;
        dot.style.boxShadow = palette.dotShadow;
      }
    } else {
      if (absentActionBtn) absentActionBtn.textContent = 'De vuelta';
      if (badge) {
        badge.style.background = palette.badgeBg;
        badge.style.color = palette.textColor;
        badge.style.borderColor = palette.badgeBorder;
      }
      if (badgeText) badgeText.textContent = 'Ausente';
      if (dot) {
        dot.style.background = palette.textColor;
        dot.style.boxShadow = palette.dotShadow;
      }
    }
  };
  tick();
  _absenceTimer = setInterval(tick, 1000);
}

function stopAbsenceCounter() {
  if (_absenceTimer) { clearInterval(_absenceTimer); _absenceTimer = null; }
  if (absenceTimerEl) absenceTimerEl.textContent = '00:00';
  if (absenceBarEl) absenceBarEl.classList.remove('show');
  // state-ok tokens (replaces iOS #30d158 / rgba(48,209,88,.X))
  const ok = { color: '#38b000', bg: 'rgba(56, 176, 0, 0.15)', border: 'rgba(56, 176, 0, 0.3)', dotShadow: '0 0 8px #38b000' };
  const badge = modal?.querySelector('#card-status-badge');
  const badgeText = modal?.querySelector('#card-badge-text');
  const dot = modal?.querySelector('#card-status-dot');
  if (badge) {
    badge.style.background = ok.bg;
    badge.style.color = ok.color;
    badge.style.borderColor = ok.border;
  }
  if (badgeText) badgeText.textContent = 'En mesa';
  if (dot) {
    dot.style.background = ok.color;
    dot.style.boxShadow = ok.dotShadow;
  }
  if (absentBtn) {
    absentBtn.textContent = 'Marcar ausente';
    absentBtn.style.background = '';
    absentBtn.style.borderColor = '';
    absentBtn.style.color = '';
  }
}

async function onToggleAbsent(e) {
  e?.preventDefault?.();
  const tableId = effectiveTableId();
  if (!tableId || !currentSeatId) return;
  try {
    if (_isAbsent) {
      await markPlayerReturned(tableId, currentSeatId);
      // Firestore notificará via onSnapshot — no hacer nada aquí
    } else {
      await markPlayerAbsent(tableId, currentSeatId);
      // Firestore notificará via onSnapshot — no hacer nada aquí
    }
  } catch (err) {
    console.error('[absence] error:', err);
    showError('No se pudo actualizar el estado de ausencia.');
  }
}

/* =================== Acciones =================== */
function onCancel(e) {
  e?.preventDefault?.();
  if (_unsubscribeSeat) { _unsubscribeSeat(); _unsubscribeSeat = null; }
  if (_unsubscribeTable) { _unsubscribeTable(); _unsubscribeTable = null; }
  stopLiveTimer();
  // NO tocar _isAbsent ni stopAbsenceCounter — el estado persiste en Firebase
  // Solo ocultar la UI del contador sin pararlo
  if (_absenceTimer) { clearInterval(_absenceTimer); _absenceTimer = null; }
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('is-open');
    modal.style.display = 'none';
  }
  document.body.classList.remove('modal-open');
}

async function onRebuy(e) {
  e?.preventDefault?.();
  const raw = (buyinInput?.value || '').trim();
  const amount = Number(raw);
  if (!amount || amount <= 0) return;
  const tableId = effectiveTableId();
  if (!tableId || !currentSeatId) return;
  const ref = doc(db, 'tables', tableId, 'seats', currentSeatId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      let data = snap.exists() ? snap.data() : {
        status: 'occupied', name: 'Jugador', playerName: 'Jugador',
        avatarUrl: '/avatars/default.png', chips: 0, buyIns: 0, movements: []
      };
      const newChips = Number(data.chips || 0) + amount;
      const newBuyIns = Number(data.buyIns || 0) + 1;
      const movements = Array.isArray(data.movements) ? [...data.movements] : [];
      movements.push({ type: 'rebuy', amount, ts: Date.now() });
      tx.set(ref, { ...data, chips: newChips, buyIns: newBuyIns, movements, updatedAt: serverTimestamp() }, { merge: true });
    });
    setChips(currentChips + amount);
    setPurchases(currentPurchasesCount + 1);
    setTotalAmount(currentTotalAmount + amount);
    if (buyinInput) buyinInput.value = '';
    // Close the modal after a successful rebuy so the operator doesn't
    // have to click 'Cancelar' as a second step. If the transaction
    // fails, the catch below keeps the modal open so the amount can
    // be retried.
    onCancel();
  } catch (err) {
    console.error('[rebuy] error', err);
    showError('No se pudo registrar el rebuy.');
  }
}

async function onCashout(e) {
  e?.preventDefault?.();
  const tableId = effectiveTableId();
  if (!tableId || !currentSeatId) return;
  const ref = doc(db, 'tables', tableId, 'seats', currentSeatId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      const data = snap.exists() ? snap.data() : null;
      const chipsBefore = Number(data?.chips || 0);
      const movements = Array.isArray(data?.movements) ? [...data.movements] : [];
      movements.push({ type: 'cashout', amount: chipsBefore, ts: Date.now() });
      tx.set(ref, {
        status: 'empty', name: '', playerName: '', avatarUrl: '',
        chips: 0, movements,
        playTime: { totalMs: 0, lastTick: Date.now() },
        player: deleteField(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    });
    setChips(0);
    if (cashoutBtn) cashoutBtn.disabled = true;
    onCancel();
  } catch (err) {
    console.error('[cashout] error', err);
    showError('No se pudo hacer cashout. Revisa reglas de Firestore.');
  }
}