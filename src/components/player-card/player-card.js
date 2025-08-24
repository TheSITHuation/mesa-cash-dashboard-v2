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

/* =================== Refs DOM =================== */
let modal,
  avatarEl,
  nameEl,
  totalAmountEl,
  purchasesCountEl,
  sessionLiveEl,
  sessionTotalEl,
  accumulatedRowEl,
  buyinInput,
  rebuyBtn,
  cashoutBtn,
  cancelBtn;

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

const USE_DELETE = false;

function isActiveStatus(s) {
  const v = String(s || '').toLowerCase();
  return v === 'active' || v === 'activa';
}

/* =================== Boot/Refs =================== */
function wireEvents() {
  if (cancelBtn && !cancelBtn._bound) { cancelBtn._bound = true; cancelBtn.onclick = onCancel; }
  if (rebuyBtn && !rebuyBtn._bound)   { rebuyBtn._bound   = true; rebuyBtn.onclick  = onRebuy; }
  if (cashoutBtn && !cashoutBtn._bound){ cashoutBtn._bound = true; cashoutBtn.onclick = onCashout; }
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
  // cerrar con ESC
  if (!document._pcEscBound) {
    document._pcEscBound = true;
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') onCancel();
    });
  }
}

function queryRefsFrom(mod) {
  avatarEl         = mod.querySelector('#card-player-avatar');
  nameEl           = mod.querySelector('#card-player-name');
  totalAmountEl    = mod.querySelector('#card-total-amount');
  purchasesCountEl = mod.querySelector('#card-purchases-count');
  sessionLiveEl    = mod.querySelector('#card-player-session-live');
  sessionTotalEl   = mod.querySelector('#card-player-session-total');
  accumulatedRowEl = mod.querySelector('#pc-row-accumulated');
  buyinInput       = mod.querySelector('#card-rebuy-amount');
  rebuyBtn         = mod.querySelector('#card-btn-rebuy');
  cashoutBtn       = mod.querySelector('#card-btn-cashout');
  cancelBtn        = mod.querySelector('#card-btn-cancel');
}

function ensureModal() {
  // 1) localizar modal existente
  let found =
    document.getElementById('player-card-modal') ||
    document.getElementById('player-card') ||
    document.querySelector('.player-card-modal') ||
    document.querySelector('.player-card');

  // 2) crear fallback mínimo si no existe
  if (!found) {
    found = document.createElement('div');
    found.id = 'player-card-modal';
    found.className = 'player-card-modal';
    found.innerHTML = `
      <div class="player-card__inner">
        <div class="pc-header">
          <img id="card-player-avatar" class="player-card__avatar" src="/avatars/default.png" alt="">
          <div id="card-player-name" class="player-card__name">Jugador</div>
        </div>
        <div class="pc-grid">
          <div><div>Ingreso:</div><div id="card-total-amount">$0</div></div>
          <div><div>Compras:</div><div id="card-purchases-count">0</div></div>
          <div><div>Tiempo de Sesión:</div><div id="card-player-session-live">00:00</div></div>
          <div><div>Acumulado:</div><div id="card-player-session-total">00:00</div></div>
        </div>
        <div class="pc-actions">
          <input id="card-rebuy-amount" placeholder="Monto Rebuy..." />
          <button id="card-btn-rebuy">Añadir Fichas</button>
          <button id="card-btn-cashout">Hacer Cash Out</button>
          <button id="card-btn-cancel">Cancelar</button>
        </div>
      </div>
    `;
  }

  // 3) ⚠️ Desengancha listeners heredados (p.ej. parallax) clonando el nodo
  if (!found.dataset.pcCleaned) {
    const clone = found.cloneNode(true);
    found.replaceWith(clone);
    found = clone;
    found.dataset.pcCleaned = '1';
  }

  // 4) Colgar SIEMPRE del body (evita ancestros con transform)
  if (found.parentElement !== document.body) document.body.appendChild(found);

  // 5) Fuerza estilos críticos del overlay
  Object.assign(found.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '5000',
    display: 'none',          // se abre en openPlayerCard()
    placeItems: 'center',
    transform: 'none'
  });

  modal = found;
  // 6) (re)tomar refs + wirear eventos
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

  // seed de datos para UX inmediata
  const name    = data?.player?.name || data?.playerName || data?.name || 'Jugador';
  const chips   = Number(data?.player?.chips ?? data?.chips ?? 0);
  const avatar  = data?.player?.avatar || data?.avatarUrl || data?.avatarURL || data?.avatar || '/avatars/default.png';
  const status  = String(data?.status || 'available').toLowerCase();
  const moves   = Array.isArray(data?.movements) ? data.movements : [];

  const totalAmount = totalPurchasesFrom(moves);
  const purchases   = countPurchases(moves);

  if (avatarEl) avatarEl.src = avatar;
  if (nameEl)   nameEl.textContent = name;

  setChips(chips);
  setPurchases(purchases);
  setTotalAmount(totalAmount);
  if (cashoutBtn) cashoutBtn.disabled = !(chips > 0 && status === 'occupied');

  // seed del timer
  const ptTotal = Number(data?.playTime?.totalMs || 0);
  const ptLast  = Number(data?.playTime?.lastTick || Date.now());
  if (sessionLiveEl) {
    sessionLiveEl.dataset.occupied = status === 'occupied' ? '1' : '0';
    sessionLiveEl.dataset.ptTotal  = String(ptTotal);
    sessionLiveEl.dataset.ptLast   = String(ptLast);
    sessionLiveEl.textContent      = msToHMS(ptTotal);
  }
  if (sessionTotalEl) sessionTotalEl.textContent = msToHMS(ptTotal);

  // mostrar estable
  modal.classList.remove('hidden');
  modal.classList.add('is-open');
  modal.style.display = 'grid';
  document.body.classList.add('modal-open');

  // realtime del asiento
  subscribeTableStatus();
  subscribeSeatRealtime();
}

/* =================== Utils =================== */
function formatMoney(n) { return Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 }); }
function totalPurchasesFrom(moves) {
  const list = Array.isArray(moves) ? moves : [];
  return list.filter(m => m && (m.type === 'buyin' || m.type === 'rebuy'))
             .reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
}
function countPurchases(moves) {
  const list = Array.isArray(moves) ? moves : [];
  return list.filter(m => m && (m.type === 'buyin' || m.type === 'rebuy')).length;
}
function effectiveTableId() { return tableIdOverride || getTableId(); }
function setChips(n) { currentChips = Number(n) || 0; }
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
  if (_liveTimer || !sessionLiveEl) return;
  _liveTimer = setInterval(() => {
    // respetar pausa de mesa
    const paused = sessionLiveEl.dataset.paused === '1';
    if (paused) return;

    const occ  = sessionLiveEl.dataset.occupied === '1';
    if (!occ) { sessionLiveEl.textContent = '00:00'; return; }

    const now  = Date.now();
    const base = Number(sessionLiveEl.dataset.ptTotal || 0);
    const last = Number(sessionLiveEl.dataset.ptLast || now);
    sessionLiveEl.textContent = msToHMS(base + Math.max(0, now - last));
  }, 1000);
}
function stopLiveTimer() { if (_liveTimer) { clearInterval(_liveTimer); _liveTimer = null; } }

/* =================== Estado de mesa (panel) =================== */
function subscribeTableStatus() {                     // ⬅️ NUEVO
  if (_unsubscribeTable) { _unsubscribeTable(); _unsubscribeTable = null; }

  const tableId = effectiveTableId();
  if (!tableId) return;

  const tableRef = doc(db, 'tables', tableId);
  _unsubscribeTable = onSnapshot(tableRef, (snap) => {
    const data = snap.exists() ? snap.data() : null;
    _tableActive = isActiveStatus(data?.status);

    // Pausar/reanudar el timer de la card sin cerrarla
    if (sessionLiveEl) {
      sessionLiveEl.dataset.paused = _tableActive ? '0' : '1';
      // Al reanudar, evita “saltar” el tiempo pausado
      if (_tableActive) {
        sessionLiveEl.dataset.ptLast = String(Date.now());
      }
    }
    // No necesitamos parar el interval; la marca 'paused' lo frena visualmente
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
    const chips  = Number(seat?.player?.chips ?? seat?.chips ?? 0);
    const hasName = !!(seat?.player?.name || seat?.playerName || seat?.name);

    const isOccupiedDoc = (status === 'occupied') || chips > 0 || hasName;

    if (!isOccupiedDoc) {
      if (cashoutBtn) cashoutBtn.disabled = true;
      if (sessionLiveEl) {
        sessionLiveEl.dataset.occupied = '0';
        sessionLiveEl.dataset.ptTotal  = '0';
        sessionLiveEl.dataset.ptLast   = String(Date.now());
        sessionLiveEl.textContent      = '00:00';
      }
      if (sessionTotalEl) sessionTotalEl.textContent = '00:00';
      return; // no cerrar la card
    }

    const name   = seat?.player?.name || seat?.playerName || seat?.name || 'Jugador';
    const avatar = seat?.player?.avatar || seat?.avatarUrl || seat?.avatarURL || '/avatars/default.png';
    if (avatarEl) avatarEl.src = avatar;
    if (nameEl)   nameEl.textContent = name;
    setChips(chips);

    const moves = Array.isArray(seat?.movements) ? seat.movements : [];
    setPurchases(countPurchases(moves));
    setTotalAmount(totalPurchasesFrom(moves));
    if (cashoutBtn) cashoutBtn.disabled = !(chips > 0);

    const ptTotal = Number(seat?.playTime?.totalMs || 0);
    const ptLast  = Number(seat?.playTime?.lastTick || Date.now());
    if (sessionLiveEl) {
      sessionLiveEl.dataset.occupied = '1';
      sessionLiveEl.dataset.ptTotal  = String(ptTotal);
      sessionLiveEl.dataset.ptLast   = String(ptLast);
      // sincroniza el flag paused según la mesa
      sessionLiveEl.dataset.paused   = _tableActive ? '0' : '1';
      sessionLiveEl.textContent      = msToHMS(ptTotal);
    }
    if (sessionTotalEl) sessionTotalEl.textContent = msToHMS(ptTotal);

    startLiveTimer();
  }, (err) => {
    console.error('[player-card] onSnapshot error:', err);
  });
}

/* =================== Acciones =================== */
function onCancel(e) {
  e?.preventDefault?.();
  if (_unsubscribeSeat)   { _unsubscribeSeat(); _unsubscribeSeat = null; }
  if (_unsubscribeTable)  { _unsubscribeTable(); _unsubscribeTable = null; } // ⬅️ NUEVO
  stopLiveTimer();
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
        status: 'occupied',
        name: 'Jugador',
        playerName: 'Jugador',
        avatarUrl: '/avatars/default.png',
        chips: 0,
        buyIns: 0,
        movements: []
      };

      const newChips  = Number(data.chips || 0) + amount;
      const newBuyIns = Number(data.buyIns || 0) + 1;
      const movements = Array.isArray(data.movements) ? [...data.movements] : [];
      movements.push({ type: 'rebuy', amount, ts: Date.now() });

      tx.set(ref, {
        ...data,
        chips: newChips,
        buyIns: newBuyIns,
        movements,
        updatedAt: serverTimestamp()
      }, { merge: true });
    });

    // Feedback inmediato (el snapshot lo confirmará)
    setChips(currentChips + amount);
    setPurchases(currentPurchasesCount + 1);
    setTotalAmount(currentTotalAmount + amount);
    if (buyinInput) buyinInput.value = '';
  } catch (err) {
    console.error('[rebuy] error', err);
    alert('No se pudo registrar el rebuy.');
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
        status: 'empty',                     // ← unificado
        name: '', playerName: '', avatarUrl: '',
        chips: 0,
        movements,
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
    alert('No se pudo hacer cashout. Revisa reglas de Firestore.');
  }
}
