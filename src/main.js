// src/main.js
import './styles/main.scss';
import './components/table-banner/table-banner.scss';
import './components/start-screen/start-screen.scss';

import { listenToTableData } from './services/firebase/tableService.js';
import { startPlayTimeTicker, stopPlayTimeTicker } from './services/firebase/playTimeService.js';
import { initSeatsRealtime, stopSeatsRealtime } from './app/seats-realtime.js';
import { renderTable } from './components/poker-table/poker-table.js';
import { renderLobby } from './pages/lobby.js';

import { initModal } from './components/seat-modal/seat-modal.js';
import { initDealerModal } from './components/dealer-modal/dealer-modal.js';
import { initSidePanel } from './components/side-panel/side-panel.js';
import { initWaitingList } from './components/waiting-list/waiting-list.js';
import { initPlayerCard } from './components/player-card/player-card.js';
import { renderStartScreen, destroyStartScreen } from './components/start-screen/start-screen.js';
import { renderTableBanner } from './components/table-banner/table-banner.js';
import { renderCreateTableForm } from './components/table-settings-modal/table-form.js';
import { getActiveTable } from './services/firebase/getActiveTable.js';
import { renderTablesManager } from './pages/tables-manager.js';
import { getTableId } from './utils/getTableId.js';

// ───────────────────────────────── Branding / Página ─────────────────────────────────
function setPageTitle(title) {
  const brand = 'Skampa Poker Room';
  document.title = title ? `${title} – ${brand}` : brand;
}
function setFavicon(href) {
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}

// ───────────────────────────────── Helpers URL/Estado ───────────────────────────────
function getParam(name) {
  const url = new URL(location.href);
  const v = url.searchParams.get(name);
  return v == null ? null : v;
}

// Fuente única de tableId (URL > global > sessionStorage)
function setActiveTableId(id) {
  if (!id) return;
  window.__ACTIVE_TABLE_ID = id;
  try { sessionStorage.setItem('activeTableId', id); } catch {}
}
function getActiveTableIdResolved() {
  const urlId = getParam('table');
  return urlId || window.__ACTIVE_TABLE_ID || sessionStorage.getItem('activeTableId') || null;
}

// Contenedor base por si falta en el HTML
function ensurePokerTableContainer() {
  const app = document.getElementById('app') || document.body;
  let container = document.querySelector('.poker-table-container');
  let table = document.querySelector('.poker-table');

  if (!container) {
    container = document.createElement('div');
    container.className = 'poker-table-container';
    app.appendChild(container);
  }
  if (!table) {
    table = document.createElement('div');
    table.className = 'poker-table';
    container.appendChild(table);
  }
  if (getComputedStyle(table).position === 'static') table.style.position = 'relative';
  if (!table.style.minHeight) table.style.minHeight = '450px';
  return table;
}

// Botón flotante “Volver al Gestor” (si lo quieres visible siempre)
function renderBackToManagerButton() {
  if (document.querySelector('.back-to-manager')) return;
  const btn = document.createElement('button');
  btn.className = 'back-to-manager';
  btn.type = 'button';
  btn.innerHTML = `
    <span class="back-to-manager__icon">↩</span>
    <span class="back-to-manager__label">Volver al Gestor</span>
  `;
  btn.addEventListener('click', () => { window.location.href = '/'; });
  document.body.appendChild(btn);
}
function removeBackToManagerButton() {
  const btn = document.querySelector('.back-to-manager');
  if (btn) btn.remove();
}

// ───────────────────────────────── UI Mesa Principal ────────────────────────────────
function initMainTableUI(mesaData, { enableTicker = true } = {}) {
  // Fija id/título
  setActiveTableId(mesaData.id);
  setPageTitle(mesaData.name || 'Mesa');

  // Inicialización de módulos UI
  initModal(mesaData.id);
  initDealerModal();
  initSidePanel(mesaData);
  const unsubscribeWaiting = initWaitingList(mesaData.id);
  initPlayerCard(mesaData.id);
  renderTableBanner(mesaData);
  destroyStartScreen();
  ensurePokerTableContainer();
  renderBackToManagerButton();

  // Estado local
  let currentSeatsMap = {};
  let currentTableData = {};
  let unsubscribeTableData = null;

  // Render centralizado
  const updateView = () => {
    // `renderTable` ya recibe {mesa, seats} en tu proyecto original
    // Aquí pasamos la mesa (currentTableData) y la lista de asientos ordenada
    renderTable(currentTableData, currentSeatsMap);
  };

  // Normalización simple de status
  const normalizeStatus = (seat) => {
    const st = (seat.status || 'available').toLowerCase();
    return st === 'available' ? 'empty' : st; // opcional
  };

  // Asientos realtime (usa la versión nueva que envía {seatsMap, seatsList})
 function onSeatsUpdate({ seatsMap }) {
   // Normaliza status y conserva forma de MAPA (clave seat_1, seat_2, ...)
   const normalized = {};
   Object.entries(seatsMap || {}).forEach(([id, seat]) => {
     const st = (seat.status || 'available').toLowerCase();
     normalized[id] = { ...seat, status: st === 'available' ? 'empty' : st };
   });
   currentSeatsMap = normalized;
   updateView();
 }
  const unsubscribeSeats = initSeatsRealtime(onSeatsUpdate, mesaData.id);

  // Datos de mesa realtime
  unsubscribeTableData = listenToTableData((data) => {
    currentTableData = data || {};
    updateView();
  }, mesaData.id);

  // Ticker central de tiempos (arranca/para con la vista)
  if (enableTicker) startPlayTimeTicker(mesaData.id);

  // Limpieza al salir o recargar
  const cleanup = () => {
    stopSeatsRealtime();
    if (unsubscribeTableData) unsubscribeTableData();
    if (typeof unsubscribeWaiting === 'function') unsubscribeWaiting();
    if (enableTicker) stopPlayTimeTicker();
    removeBackToManagerButton();
  };
  window.addEventListener('beforeunload', cleanup, { once: true });
}

// ───────────────────────────────── Modo Espejo (Display) ────────────────────────────
async function openMirrorFlow() {
  const explicitId = getParam('table');

  const { db } = await import('./services/config/firebaseConfig.js');
  const { doc, getDoc } = await import('firebase/firestore');
  const getMesa = async (id) => {
    if (!id) return null;
    const snap = await getDoc(doc(db, 'tables', id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() }) : null;
  };

  let mesa = null;
  if (explicitId) {
    mesa = await getMesa(explicitId);
  } else {
    try { mesa = await getActiveTable(); } catch {}
  }

  if (mesa) {
    setPageTitle(`Pantalla: ${mesa.name || 'Mesa'}`);
    destroyStartScreen();
    initMainTableUI(mesa, { enableTicker: false });
  } else {
    destroyStartScreen();
    const host = ensurePokerTableContainer();
    const msg = document.createElement('div');
    msg.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;opacity:.8;font-weight:600;';
    msg.textContent = 'No hay mesa activa para mostrar.';
    host.appendChild(msg);
  }
}

// ───────────────────────────────── Boot ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  setFavicon('/branding/favicon.png');
  setPageTitle('Gestor de mesas');

  const tableParam = getParam('table');     // id de mesa o null
  const viewParam  = getParam('view');      // 'admin' | 'display' (opcional)
  const mirrorFlag = getParam('mirror');    // '1' (opcional)
  const isMirror = (mirrorFlag === '1') || (viewParam === 'display');

    const lobbyParam = getParam('lobby');        // <-- NUEVO
  if (lobbyParam === '1') {                    // <-- NUEVO
    destroyStartScreen?.();                    // si lo usas
    renderLobby();                             // <-- NUEVO
    return;                                    // <-- NUEVO
  }

  // SIN ?table=  → Gestor de Mesas
  if (!tableParam) {
    destroyStartScreen();
    renderTablesManager();
    return;
  }

  // CON ?table= y modo espejo
  if (isMirror) {
    renderStartScreen(() => renderCreateTableForm());
    await openMirrorFlow();
    return;
  }

  // CON ?table=  → flujo normal de mesa
  if (viewParam === 'display') {
    document.documentElement.classList.add('mirror-display-ready');
  }

  renderStartScreen(() => renderCreateTableForm());

  // 1) Intentar abrir la mesa indicada o recordada
  const urlOrRememberedId = getActiveTableIdResolved();
  if (urlOrRememberedId) {
    try {
      const { db } = await import('./services/config/firebaseConfig.js');
      const { doc, getDoc } = await import('firebase/firestore');
      const snap = await getDoc(doc(db, 'tables', urlOrRememberedId));
      if (snap.exists()) {
        const mesa = { id: snap.id, ...snap.data() };
        setActiveTableId(mesa.id);
        destroyStartScreen();
        initMainTableUI(mesa);
        return;
      }
    } catch (e) {
      console.warn('[main] No se pudo abrir mesa por URL/recordada:', e);
    }
  }

  // 2) Fallback: mesa activa
  const mesaActiva = await getActiveTable();
  if (mesaActiva) {
    setActiveTableId(mesaActiva.id);
    destroyStartScreen();
    initMainTableUI(mesaActiva);
  } else {
    destroyStartScreen();
    renderTablesManager();
  }
});

// Parallax opcional (puedes quitarlo si no lo usas)
function addParallax(selector, maxTilt = 6) {
  document.querySelectorAll(selector).forEach(el => {
    let rect = null;
    const baseTransform = getComputedStyle(el).transform === 'none' ? '' : getComputedStyle(el).transform;

    const onMove = (e) => {
      rect = rect || el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top  + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      // 👇 combinamos con el transform original
      el.style.transform = `${baseTransform} rotateX(${-dy * maxTilt}deg) rotateY(${dx * maxTilt}deg) translateZ(0)`;
    };
    const onLeave = () => { rect = null; el.style.transform = baseTransform || 'none'; };
    el.style.transformStyle = 'preserve-3d';
    el.style.transition = 'transform .18s ease';
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
  });
}

addParallax('.side-panel .panel-section.ios-elevate, .modal-content');
