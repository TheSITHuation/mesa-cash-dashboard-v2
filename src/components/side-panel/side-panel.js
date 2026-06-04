// src/components/side-panel/side-panel.js
// Panel lateral (glass) — controla estado de mesa y timers. Admin emite estado de UI; mirror solo lee.

import { renderWaitingList } from '../waiting-list/waiting-list.js';
import { listenToTableData, updateTableStatus } from '../../services/firebase/tableService.js';
import { addToWaitingList } from '../../services/firebase/waitingListService.js';

import { db } from '../../services/config/firebaseConfig.js';
import {
  doc, getDoc, onSnapshot, updateDoc, serverTimestamp,
  collection, getDocs, writeBatch
} from 'firebase/firestore';

import { getTableId } from '../../utils/getTableId.js';
import { startPlayTimeTicker, stopPlayTimeTicker } from '../../services/firebase/playTimeService.js';
import { setDisplayState } from '../../services/displaySync.js';

import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import TimerDisplay from '../timer-display/TimerDisplay.jsx';

// --- DOM (se reobtienen en init) ---
let sidePanelEl = document.getElementById('side-panel');
let panelFabBtn = document.getElementById('panel-fab');
let timerRoot     = null;
let timerEl       = null;
let createdAtTextEl = null;
let stateIconsWrap  = null;
let waitingSection  = null;
let wlAddBtn        = null;
let addPlayerForm   = null;
let addPlayerInput  = null;
let confirmAddBtn   = null;
let exportCsvBtn    = null;

let sessionInterval = null;

/* Montaje: asegura panel/FAB bajo <body> creando el HTML dinámicamente */
function normalizeMountPoint() {
  if (!document.getElementById('side-panel')) {
    const aside = document.createElement('aside');
    aside.id = 'side-panel';
    aside.className = 'side-panel side-panel--glass';
    aside.innerHTML = `
      <div class="panel-content">
        <div class="panel-header">
          <span class="panel-header__title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
            Panel de Mesa
          </span>
          <div class="panel-header__actions">
            <button id="panel-mirror-btn" class="panel-icon-btn" type="button" aria-label="Abrir espejo en nueva ventana" title="Abrir espejo">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            </button>
          </div>
        </div>

        <section class="panel-section">
          <div class="panel-section__label">Estado de la Mesa</div>
          <div class="glass-radio-group" id="state-icons" role="radiogroup" aria-label="Estado de la mesa">
            <input type="radio" name="table-state" id="state-activa" value="activa" />
            <label for="state-activa" data-state="activa">Activa</label>
            <input type="radio" name="table-state" id="state-pausa" value="en espera" />
            <label for="state-pausa" data-state="en espera">Pausa</label>
            <input type="radio" name="table-state" id="state-stop" value="inactiva" />
            <label for="state-stop" data-state="inactiva">Stop</label>
            <div class="glass-glider"></div>
          </div>
        </section>

        <section class="panel-section">
          <div class="panel-section__label">Sesión</div>
          <div class="timer-box-new">
            <div id="session-timer-root" class="timer-value-new" role="timer" aria-live="off"></div>
            <div id="created-at-text" class="timer-started-new"></div>
          </div>
        </section>

        <section class="panel-section" id="waiting-list-section">
          <div class="wl-header-new">
            <div class="panel-section__label wl-header-new__label">Lista de Espera</div>
            <div class="wl-header-new__actions">
              <span class="wl-badge-count" id="wl-count-badge" aria-label="Jugadores en espera">0</span>
              <button id="wl-add-btn" class="wl-add-btn-new" type="button" aria-label="Añadir jugador a la lista">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          </div>
          <ul id="waiting-list" class="waiting-list-new" aria-live="polite"></ul>
          <div id="add-player-form" class="add-player-form-new hidden">
            <label for="player-name-input" class="visually-hidden">Nombre del jugador</label>
            <input type="text" id="player-name-input" class="wl-input-new" placeholder="Nombre..."/>
            <button id="confirm-add-player-btn" class="wl-submit-new" type="button">Añadir</button>
          </div>
        </section>
      </div>
      <div id="panel-aria-live" class="visually-hidden" role="status" aria-live="polite" aria-atomic="true"></div>
    `;
    document.body.appendChild(aside);
  }

  if (!document.getElementById('panel-fab')) {
    const fab = document.createElement('button');
    fab.id = 'panel-fab';
    fab.className = 'panel-fab';
    fab.type = 'button';
    fab.setAttribute('aria-label', 'Alternar panel de mesa');
    fab.setAttribute('aria-expanded', 'true');
    fab.setAttribute('aria-controls', 'side-panel');
    fab.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    `;
    document.body.appendChild(fab);
  }
}

/* ===== Tiles visuales ===== */
function markTile(selector, state = 'on') {
  const el = document.querySelector(selector);
  if (!el) return;
  el.classList.remove('is-on', 'is-danger');
  if (state === 'on') el.classList.add('is-on');
  if (state === 'danger') el.classList.add('is-danger');
}
function resetTiles() {
  document.querySelectorAll('.cc-tile').forEach(el => el.classList.remove('is-on', 'is-danger'));
}
function reflectStatusOnTiles(status) {
  resetTiles();
  if (status === 'activa') markTile('.cc-tile[data-action="play"]', 'on');
  else if (status === 'en espera') markTile('.cc-tile[data-action="pause"]', 'on');
  else if (status === 'inactiva') markTile('.cc-tile[data-action="stop"]', 'danger');
}

/* ===== Tiempo UI ===== */
function formatTime(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00:00';
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2,'0');
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2,'0');
  const s = String(totalSeconds % 60).padStart(2,'0');
  return `${h}:${m}:${s}`;
}
function computeElapsedForState(d) {
  const state          = d?.sessionState || 'idle';
  const startAt        = d?.sessionStartAt;
  const pausedTotalMs  = Number(d?.pausedTotalMs || 0);
  const pauseStartedMs = d?.pauseStartedAt?.toMillis?.() ?? null;

  // Handle Firestore Timestamp or plain number
  let startMs = null;
  if (startAt) {
    if (typeof startAt.toMillis === 'function') {
      startMs = startAt.toMillis();
    } else if (typeof startAt === 'number') {
      startMs = startAt;
    } else if (startAt.seconds) {
      startMs = startAt.seconds * 1000 + (startAt.nanoseconds || 0) / 1e6;
    }
  }

  if (!startMs) return 0;
  if (state === 'running') {
    const now = Date.now();
    return Math.max(0, Math.floor((now - startMs - pausedTotalMs) / 1000));
  }
  if (state === 'paused') {
    const stopMs = pauseStartedMs || Date.now();
    return Math.max(0, Math.floor((stopMs - startMs - pausedTotalMs) / 1000));
  }
  return 0;
}
function startPanelTicker(getData) {
  if (sessionInterval) clearInterval(sessionInterval);
  sessionInterval = setInterval(() => {
    const d = getData();
    if (timerRoot) {
      const st = d.sessionState || 'idle';
      const paused = (st === 'paused' || st === 'idle');
      const elapsed = computeElapsedForState(d);
      timerRoot.render(createElement(TimerDisplay, { totalSeconds: elapsed, paused }));
    }
  }, 1000);
}

/* ===== Persistencia de sesión de mesa ===== */
async function startSession(tableId) {
  const ref = doc(db, 'tables', tableId);
  // Use local timestamp as fallback, serverTimestamp will overwrite on sync
  const localNow = Date.now();
  await updateDoc(ref, {
    sessionState: 'running',
    sessionStartAt: localNow,
    pauseStartedAt: null,
    pausedTotalMs: 0,
    updatedAt: serverTimestamp(),
  });
}
async function pauseSession(tableId) {
  const ref = doc(db, 'tables', tableId);
  await updateDoc(ref, {
    sessionState: 'paused',
    pauseStartedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
async function resumeSession(tableId) {
  const ref = doc(db, 'tables', tableId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const d = snap.data();
  const pauseStartedAtMs = d?.pauseStartedAt?.toMillis?.() ?? null;
  const pausedTotalMs    = Number(d?.pausedTotalMs || 0);
  const extra            = pauseStartedAtMs ? (Date.now() - pauseStartedAtMs) : 0;
  await updateDoc(ref, {
    sessionState: 'running',
    pauseStartedAt: null,
    pausedTotalMs: pausedTotalMs + extra,
    updatedAt: serverTimestamp(),
  });
}
async function resetSession(tableId) {
  const ref = doc(db, 'tables', tableId);
  await updateDoc(ref, {
    sessionState: 'idle',
    sessionStartAt: null,
    pauseStartedAt: null,
    pausedTotalMs: 0,
    updatedAt: serverTimestamp(),
  });
}

/* ===== Timers por asiento (batch) ===== */
async function pauseAllSeatTimers(tableId) {
  if (!tableId) tableId = getTableId();
  if (!tableId) return;
  const colRef = collection(db, 'tables', tableId, 'seats');
  const qs = await getDocs(colRef);
  const now = Date.now();
  const batch = writeBatch(db);
  qs.forEach(d => {
    const seat = d.data();
    if (!seat || seat.status !== 'occupied') return;
    const pt = seat.playTime || {};
    const last = typeof pt.lastTick === 'number' ? pt.lastTick : now;
    const base = Number(pt.totalMs || 0);
    const delta = Math.max(0, now - last);
    batch.update(d.ref, {
      playTime: { totalMs: base + delta, lastTick: now, paused: true },
      updatedAt: serverTimestamp()
    });
  });
  await batch.commit();
}
async function resumeAllSeatTimers(tableId) {
  if (!tableId) tableId = getTableId();
  if (!tableId) return;
  const colRef = collection(db, 'tables', tableId, 'seats');
  const qs = await getDocs(colRef);
  const now = Date.now();
  const batch = writeBatch(db);
  qs.forEach(d => {
    const seat = d.data();
    if (!seat || seat.status !== 'occupied') return;
    const pt = seat.playTime || {};
    batch.update(d.ref, {
      playTime: { totalMs: Number(pt.totalMs || 0), lastTick: now, paused: false },
      updatedAt: serverTimestamp()
    });
  });
  await batch.commit();
}

/* ===== Init principal ===== */
export function initSidePanel(mesaData) {
  normalizeMountPoint();

  // Re-obtener referencias después de montar el DOM
  sidePanelEl      = document.getElementById('side-panel');
  panelFabBtn      = document.getElementById('panel-fab');
  const timerRootEl = document.getElementById('session-timer-root');
  createdAtTextEl  = document.getElementById('created-at-text');
  stateIconsWrap   = document.getElementById('state-icons');
  waitingSection   = document.getElementById('waiting-list-section');
  wlAddBtn         = document.getElementById('wl-add-btn');
  addPlayerForm    = document.getElementById('add-player-form');
  addPlayerInput   = document.getElementById('player-name-input');
  confirmAddBtn    = document.getElementById('confirm-add-player-btn');
  const ariaLive   = document.getElementById('panel-aria-live');

  if (!sidePanelEl) return;

  // Mount React timer
  if (timerRootEl && !timerRoot) {
    timerRoot = createRoot(timerRootEl);
    timerRoot.render(createElement(TimerDisplay, { totalSeconds: 0, paused: true }));
  }

  if (!sidePanelEl) return;

  const tableId = mesaData?.id || getTableId();

  // Seguridad: cuelga en body
  if (sidePanelEl.parentElement !== document.body) document.body.appendChild(sidePanelEl);
  if (panelFabBtn && panelFabBtn.parentElement !== document.body) document.body.appendChild(panelFabBtn);

  const IS_DISPLAY = document.body.classList.contains('is-display');

  // Helper: anuncia mensajes al aria-live region
  const announce = (msg) => {
    if (!ariaLive || !msg) return;
    ariaLive.textContent = '';
    // microtask to ensure screen reader picks up the change
    setTimeout(() => { ariaLive.textContent = msg; }, 30);
  };

  // ── ADMIN: emite al mirror apertura/cierre y cambio de tab ──
  if (!IS_DISPLAY) {
    // Emite panelOpen cuando cambia la clase
    const obs = new MutationObserver(() => {
      const open = sidePanelEl.classList.contains('is-open');
      setDisplayState(tableId, { panelOpen: !!open, ts: Date.now() });
      if (panelFabBtn) panelFabBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    obs.observe(sidePanelEl, { attributes: true, attributeFilter: ['class'] });

    // Emite pestaña activa cuando se hace clic en tabs dentro del panel
    sidePanelEl.addEventListener('click', (ev) => {
      const btn = ev.target.closest?.('[data-panel-tab],[data-tab]');
      if (!btn) return;
      const tab = btn.dataset.panelTab || btn.dataset.tab;
      if (tab) setDisplayState(tableId, { activePanelTab: tab, ts: Date.now() });
    });

    // Estado inicial
    setDisplayState(tableId, { panelOpen: sidePanelEl.classList.contains('is-open'), ts: Date.now() });
  }

  // ▶ Abierto por defecto (excepto en display)
  if (!IS_DISPLAY) {
    sidePanelEl.classList.add('is-open');
    panelFabBtn?.classList.add('is-open');
    panelFabBtn?.setAttribute('aria-expanded', 'true');
  }

  // FAB open/close (en display está oculto por CSS)
  panelFabBtn?.addEventListener('click', () => {
    const isOpen = sidePanelEl.classList.toggle('is-open');
    panelFabBtn.classList.toggle('is-open', isOpen);
    panelFabBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // Cerrar con ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidePanelEl.classList.contains('is-open')) {
      sidePanelEl.classList.remove('is-open');
      panelFabBtn?.classList.remove('is-open');
      panelFabBtn?.setAttribute('aria-expanded', 'false');
    }
  });

  // Texto "Iniciada el …"
  const createdAt = mesaData?.createdAt?.toDate?.() || new Date();
  if (createdAtTextEl) {
    const fmt = { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:true };
    createdAtTextEl.textContent = `Iniciada el: ${createdAt.toLocaleString('es-MX', fmt)}`;
  }

  // Controles de estado (radio group)
  stateIconsWrap?.addEventListener('click', async (ev) => {
    const label = ev.target.closest('label[data-state]');
    if (!label) return;
    const status = label.dataset.state;
    const radio = stateIconsWrap.querySelector(`input[value="${status}"]`);
    if (radio) radio.checked = true;

    // persiste status de mesa
    updateTableStatus(status, tableId);

    // timers + ticker
    try {
      const ref  = doc(db, 'tables', tableId);
      const snap = await getDoc(ref);
      const d    = snap.exists() ? snap.data() : { sessionState: 'idle' };

      if (status === 'activa') {
        await resumeAllSeatTimers(tableId);
        if (d.sessionState === 'paused') await resumeSession(tableId);
        else if (d.sessionState !== 'running') await startSession(tableId);
        startPlayTimeTicker(tableId);
        if (timerEl) timerEl.dataset.paused = '0';
      } else if (status === 'en espera') {
        await pauseAllSeatTimers(tableId);
        if (d.sessionState === 'running') await pauseSession(tableId);
        stopPlayTimeTicker();
        if (timerEl) timerEl.dataset.paused = '1';
      } else if (status === 'inactiva') {
        await pauseAllSeatTimers(tableId);
        await resetSession(tableId);
        stopPlayTimeTicker();
        if (timerEl) timerEl.dataset.paused = '1';
      }

      reflectStatusOnTiles(status);
    } catch (e) {
      console.error('[side-panel] error controlando sesión', e);
    }
  });

  // Realtime mesa para timer/estado/fecha
  const tableRef = doc(db, 'tables', tableId);
  let latestData = mesaData || {};
  onSnapshot(tableRef, (snap) => {
    if (!snap.exists()) return;
    latestData = snap.data();

    if (latestData.status && stateIconsWrap) {
      const radio = stateIconsWrap.querySelector(`input[value="${latestData.status}"]`);
      if (radio) radio.checked = true;
      reflectStatusOnTiles(latestData.status);
    }

    if (createdAtTextEl && latestData.createdAt?.toDate) {
      const dt = latestData.createdAt.toDate();
      const fmt = { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:true };
      createdAtTextEl.textContent = `Iniciada el: ${dt.toLocaleString('es-MX', fmt)}`;
    }

    if (timerRoot) {
      const st = latestData.sessionState || 'idle';
      const paused = (st === 'paused' || st === 'idle');
      const elapsed = computeElapsedForState(latestData);
      timerRoot.render(createElement(TimerDisplay, { totalSeconds: elapsed, paused }));
    }
  });
  startPanelTicker(() => latestData);

  // Waitlist realtime (si usas este render)
  const unlisten = listenToTableData((tableData) => {
    if (!tableData) return;
    renderWaitingList(tableData.waitingList);
  }, tableId);

  // Botón espejo
document.getElementById('panel-mirror-btn')?.addEventListener('click', () => {
  const tid = tableId || getTableId();
  if (!tid) return;
  window.open(`${location.origin}${location.pathname}?mirror=1&table=${tid}`, '_blank');
});

  // Export CSV — pendiente: getTableReportData() aún devuelve null
  // (exportCsvBtn no está en el template; se re-agregará cuando se implemente)


}
