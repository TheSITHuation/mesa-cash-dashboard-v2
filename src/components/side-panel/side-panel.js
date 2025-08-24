// src/components/side-panel/side-panel.js
// Panel lateral (glass) — controla estado de mesa y gobierna timers (panel + asientos)

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

// --- DOM ---
const sidePanelEl      = document.getElementById('side-panel');
const panelFabBtn      = document.getElementById('panel-fab');

const timerEl          = document.getElementById('session-timer');
const createdAtTextEl  = document.getElementById('created-at-text');

// nuevo: controles con iconos
const stateIconsWrap   = document.getElementById('state-icons');

// lista / acciones
const waitingSection   = document.getElementById('waiting-list-section');
const wlAddBtn         = document.getElementById('wl-add-btn');
const addPlayerForm    = document.getElementById('add-player-form');
const addPlayerInput   = document.getElementById('player-name-input');
const confirmAddBtn    = document.getElementById('confirm-add-player-btn');
const exportCsvBtn     = document.getElementById('export-csv-btn');

let sessionInterval = null;

/* ───────────────────────── helpers de tiempo (UI) ───────────────────────── */
function formatTime(totalSeconds) {
  if (isNaN(totalSeconds) || totalSeconds < 0) return '00:00:00';
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}
function computeElapsedForState(d) {
  const state          = d?.sessionState || 'idle';
  const startMs        = d?.sessionStartAt?.toMillis?.() ?? null;
  const pausedTotalMs  = Number(d?.pausedTotalMs || 0);
  const pauseStartedMs = d?.pauseStartedAt?.toMillis?.() ?? null;

  if (!startMs) return 0;

  if (state === 'running') {
    const now = Date.now();
    return Math.max(0, Math.floor((now - startMs - pausedTotalMs) / 1000));
  }
  if (state === 'paused') {
    const stopMs = pauseStartedMs || Date.now();
    return Math.max(0, Math.floor((stopMs - startMs - pausedTotalMs) / 1000));
  }
  return 0; // idle
}
function startPanelTicker(getData) {
  if (sessionInterval) clearInterval(sessionInterval);
  sessionInterval = setInterval(() => {
    const d = getData();
    if (timerEl) timerEl.textContent = formatTime(computeElapsedForState(d));
  }, 1000);
}

/* ────────────── helpers que PERSISITEN sesión en la mesa ─────────────── */
async function startSession(tableId) {
  const ref = doc(db, 'tables', tableId);
  await updateDoc(ref, {
    sessionState: 'running',
    sessionStartAt: serverTimestamp(),
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

/* ────────────── GOBIERNO de timers por asiento (batch) ─────────────── */
/** Pausa todos los asientos ocupados: acumula delta y marca paused:true */
async function pauseAllSeatTimers(tableId) {
  if (!tableId) tableId = getTableId();
  if (!tableId) return;
  const colRef = collection(db, 'tables', tableId, 'seats');
  const qs = await getDocs(colRef);
  const now = Date.now();
  const batch = writeBatch(db);

  qs.forEach((d) => {
    const seat = d.data();
    if (!seat || seat.status !== 'occupied') return;

    const pt = seat.playTime || {};
    const last = typeof pt.lastTick === 'number' ? pt.lastTick : now;
    const base = Number(pt.totalMs || 0);
    const delta = Math.max(0, now - last);

    batch.update(d.ref, {
      playTime: {
        totalMs: base + delta,
        lastTick: now,
        paused: true
      },
      updatedAt: serverTimestamp()
    });
  });

  await batch.commit();
}

/** Reanuda todos los asientos ocupados: paused:false y lastTick=now */
async function resumeAllSeatTimers(tableId) {
  if (!tableId) tableId = getTableId();
  if (!tableId) return;
  const colRef = collection(db, 'tables', tableId, 'seats');
  const qs = await getDocs(colRef);
  const now = Date.now();
  const batch = writeBatch(db);

  qs.forEach((d) => {
    const seat = d.data();
    if (!seat || seat.status !== 'occupied') return;
    const pt = seat.playTime || {};
    batch.update(d.ref, {
      playTime: {
        totalMs: Number(pt.totalMs || 0),
        lastTick: now,
        paused: false
      },
      updatedAt: serverTimestamp()
    });
  });

  await batch.commit();
}

/* ───────────────────────────── Init principal ─────────────────────────── */
export function initSidePanel(mesaData) {
  if (!sidePanelEl) return;

  const tableId = mesaData?.id || getTableId();

  // FAB open/close
  panelFabBtn?.addEventListener('click', () => {
    sidePanelEl.classList.toggle('is-open');
    panelFabBtn.classList.toggle('is-open');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidePanelEl.classList.contains('is-open')) {
      sidePanelEl.classList.remove('is-open');
      panelFabBtn?.classList.remove('is-open');
    }
  });

  // Texto "Iniciada el …"
  const createdAt = mesaData?.createdAt?.toDate?.() || new Date();
  if (createdAtTextEl) {
    const fmt = { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:true };
    createdAtTextEl.textContent = `🕓 Iniciada el: ${createdAt.toLocaleString('es-MX', fmt)}`;
  }

  // Controles de estado con iconos
  stateIconsWrap?.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('.state-btn');
    if (!btn) return;
    const status = btn.dataset.state; // 'activa' | 'en espera' | 'inactiva'

    // pinta activo
    for (const el of stateIconsWrap.querySelectorAll('.state-btn')) el.classList.remove('active');
    btn.classList.add('active');

    // Guarda status de la mesa (campo status)
    updateTableStatus(status);

    // Controla sesión + timers por asiento + ticker central
    try {
      const ref  = doc(db, 'tables', tableId);
      const snap = await getDoc(ref);
      const d    = snap.exists() ? snap.data() : { sessionState: 'idle' };

      if (status === 'activa') {
        await resumeAllSeatTimers(tableId);
        if (d.sessionState === 'paused') await resumeSession(tableId);
        else if (d.sessionState !== 'running') await startSession(tableId);
        startPlayTimeTicker(tableId);                // asegura escritura periódica
        timerEl && (timerEl.dataset.paused = '0');   // UI
      } else if (status === 'en espera') {
        await pauseAllSeatTimers(tableId);
        if (d.sessionState === 'running') await pauseSession(tableId);
        stopPlayTimeTicker();
        timerEl && (timerEl.dataset.paused = '1');
      } else if (status === 'inactiva') {
        await pauseAllSeatTimers(tableId);
        await resetSession(tableId);
        stopPlayTimeTicker();
        timerEl && (timerEl.dataset.paused = '1');
      }
    } catch (e) {
      console.error('[side-panel] error controlando sesión', e);
    }
  });

  // Realtime del doc mesa para timer y estado activo
  const tableRef = doc(db, 'tables', tableId);
  let latestData = mesaData || {};
  onSnapshot(tableRef, (snap) => {
    if (!snap.exists()) return;
    latestData = snap.data();

    // marca icono activo si viene status desde backend
    if (latestData.status && stateIconsWrap) {
      for (const el of stateIconsWrap.querySelectorAll('.state-btn')) {
        el.classList.toggle('active', el.dataset.state === latestData.status);
      }
    }
    // dataset.paused según sessionState
    if (timerEl) {
      const st = latestData.sessionState || 'idle';
      timerEl.dataset.paused = (st === 'paused' || st === 'idle') ? '1' : '0';
      timerEl.textContent = formatTime(computeElapsedForState(latestData));
    }
  });
  startPanelTicker(() => latestData);

  // Waitlist realtime (tu lógica de siempre)
  listenToTableData((tableData) => {
    if (!tableData) return;
    renderWaitingList(tableData.waitingList);
  });

  // Botón icono "añadir jugador" -> muestra/oculta el formulario
  wlAddBtn?.addEventListener('click', () => {
    waitingSection?.classList.toggle('is-adding');
    if (waitingSection?.classList.contains('is-adding')) {
      setTimeout(() => addPlayerInput?.focus(), 50);
    }
  });

  // Confirmar añadir
  confirmAddBtn?.addEventListener('click', async () => {
    const name = (addPlayerInput?.value || '').trim();
    if (!name) return;
    await addToWaitingList(name, tableId);
    if (addPlayerInput) addPlayerInput.value = '';
    waitingSection?.classList.remove('is-adding');
  });

  // Export CSV
  exportCsvBtn?.addEventListener('click', handleExportCSV);
  console.log('Side panel listo.');
}

/* ───────────────────────────── CSV (placeholder) ───────────────────────── */
async function handleExportCSV() {
  alert('Generando reporte CSV...');

  const reportData = await getTableReportData();
  if (!reportData || !reportData.tableInfo || !reportData.seats) {
    alert('No se pudieron obtener los datos para generar el reporte.');
    return;
  }

  const headers = ['Asiento','Jugador','Fichas Finales','Total Comprado','Tiempo en Mesa (HH:MM:SS)'];
  let csvContent = headers.join(',') + '\r\n';

  reportData.seats.forEach((seat) => {
    if (seat.status === 'occupied') {
      const totalBuyIn = seat.buyInHistory ? seat.buyInHistory.reduce((a, b) => a + b, 0) : 0;
      const sessionSeconds = seat.sitDownTime ? Math.floor((new Date() - seat.sitDownTime.toDate()) / 1000) : 0;
      const row = [
        seat.id.replace('asiento_', ''),
        `"${seat.playerName}"`,
        seat.chips,
        totalBuyIn,
        `"${formatTime(sessionSeconds)}"`,
      ];
      csvContent += row.join(',') + '\r\n';
    }
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url  = URL.createObjectURL(blob);
  const timestamp = new Date().toISOString().slice(0,16).replace('T','_').replace(/:/g,'-');
  link.href = url;
  link.download = `reporte_mesa_${timestamp}.csv`;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Si tienes un servicio real de reportes, reemplázalo.
async function getTableReportData() {
  return null;
}
