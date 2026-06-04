// src/main.js
window.onerror = function(msg, url, lineNo, columnNo, error) {
  const div = document.createElement('div');
  div.style.cssText = 'position:fixed;top:0;left:0;width:100%;padding:20px;background:#900;color:white;z-index:99999;font-family:sans-serif;box-shadow:0 10px 30px rgba(0,0,0,0.5);border-bottom:3px solid white;';
  div.innerHTML = `<h2 style="margin:0 0 10px 0">⚠️ ERROR DETECTADO</h2>
                   <div style="background:rgba(0,0,0,0.2);padding:10px;border-radius:5px;margin-bottom:10px"><b>${msg}</b></div>
                   <div style="font-size:12px;opacity:0.8">Archivo: ${url}<br>Línea: ${lineNo}</div>`;
  document.body.appendChild(div);
  return false;
};
import './styles/main.scss';

import { listenToTableData } from './services/firebase/tableService.js';
import { startPlayTimeTicker, stopPlayTimeTicker } from './services/firebase/playTimeService.js';
import { initSeatsRealtime, stopSeatsRealtime } from './app/seats-realtime.js';
import { renderTable } from './components/poker-table/poker-table.js';
import { renderTd3Bridge } from './pages/td3-bridge.js';

import { initDealerModal } from './components/dealer-modal/dealer-modal.js';
import { initSidePanel } from './components/side-panel/side-panel.js';
import { initWaitingList } from './components/waiting-list/waiting-list.js';
import { initPlayerCard } from './components/player-card/player-card.js';
import { renderTableBanner } from './components/table-banner/table-banner.js';
import { getActiveTable } from './services/firebase/getActiveTable.js';
import { renderTablesManager } from './pages/tables-manager.js';
import { listenPendingArrivals } from './services/firebase/pendingArrivalsService.js';
import { initPendingArrivalsListener } from './ui/pendingArrivalNotification.js';
import { watchAuth } from './services/config/firebaseConfig.js';
import { showLogin, hideLogin } from './ui/login-modal.js';
import { showVerifyEmail, hideVerifyEmail } from './ui/verify-email-modal.js';
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import TableApp from './TableApp.jsx';

// ───────────── Splash Screen Helper ─────────────
function hideSplashScreen(delay = 600) {
  const splash = document.getElementById('splash-screen');
  if (splash) {
    setTimeout(() => {
      splash.classList.add('hidden');
      document.body.style.overflow = 'auto'; // Forzamos restauración de scroll
      setTimeout(() => splash.remove(), 1000);
    }, delay);
  }
}

// ───────────── Helpers ─────────────
function setPageTitle (title) {
  const brand = 'Experience Poker Room';
  document.title = title ? `${title} – ${brand}` : brand;
}
function setFavicon (href) {
  let link = document.querySelector('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}
function setBodyView (view) {
  document.body.className = document.body.className
    .split(' ')
    .filter(c => !/^is-(table|manager|lobby|display)$/.test(c))
    .join(' ');
  if (view) document.body.classList.add(view);
}
function getParam (name) {
  const url = new URL(location.href);
  const v = url.searchParams.get(name);
  return v == null ? null : v;
}
function isDisplay () { return document.body.classList.contains('is-display'); }

function setActiveTableId (id) {
  if (!id) return;
  window.__ACTIVE_TABLE_ID = id;
  try { sessionStorage.setItem('activeTableId', id); } catch {}
}
function getActiveTableIdResolved () {
  const urlId = getParam('table');
  return urlId || window.__ACTIVE_TABLE_ID || sessionStorage.getItem('activeTableId') || null;
}

function ensurePokerTableContainer () {
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

function renderBackToManagerButton () {
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
function removeBackToManagerButton () {
  const btn = document.querySelector('.back-to-manager');
  if (btn) btn.remove();
}

// ───────────── UI principal ─────────────
function initMainTableUI (mesaData, { enableTicker = true } = {}) {
  setActiveTableId(mesaData.id);
  setPageTitle(mesaData.name || 'Mesa');

  initDealerModal();
  initSidePanel(mesaData);
  const unsubscribeWaiting = initWaitingList(mesaData.id);
  initPlayerCard(mesaData.id);
  renderTableBanner(mesaData);
  ensurePokerTableContainer();
  //renderBackToManagerButton();

  const tableId = mesaData.id;

  let currentSeatsMap = {};
  let currentTableData = {};

  const updateView = () => { renderTable(currentTableData, currentSeatsMap); };

  function onSeatsUpdate ({ seatsMap }) {
    const normalized = {};
    Object.entries(seatsMap || {}).forEach(([id, seat]) => {
      const st = (seat.status || 'available').toLowerCase();
      normalized[id] = { ...seat, status: st === 'available' ? 'empty' : st };
    });
    currentSeatsMap = normalized;
    updateView();
  }
  const unsubscribeSeats = initSeatsRealtime(onSeatsUpdate, tableId);

  const unsubscribeTableData = listenToTableData((data) => {
    currentTableData = data || {};
    updateView();
  }, tableId);

  // ─── Pending arrivals ───
  const unsubscribeArrivals = initPendingArrivalsListener(tableId, listenPendingArrivals);

  if (enableTicker) startPlayTimeTicker(tableId);

  // ESPEJO (display)
  let displayUnsub = null;
  if (isDisplay()) {
    import('./services/displaySync.js').then(({ watchDisplayState }) => {
      const applyDisplayState = (st = {}) => {
        const side = document.querySelector('.side-panel');
        if (side && typeof st.panelOpen === 'boolean') {
          side.classList.toggle('is-open', st.panelOpen);
        }
        if (st.activePanelTab) {
          const q1 = `[data-panel-tab="${st.activePanelTab}"]`;
          const q2 = `[data-tab="${st.activePanelTab}"]`;
          const tabBtn = document.querySelector(q1) || document.querySelector(q2);
          if (tabBtn && typeof tabBtn.click === 'function') tabBtn.click();
        }
        if (st.focusSeatId) {
          const seatEl = document.querySelector(`[data-seat-id="${st.focusSeatId}"]`) ||
                         document.querySelector(`#${st.focusSeatId}`);
          if (seatEl) {
            seatEl.classList.add('mirror-focus');
            setTimeout(() => seatEl.classList.remove('mirror-focus'), 1200);
          }
        }
      };
      displayUnsub = watchDisplayState(tableId, applyDisplayState);
    });
  } else {
    import('./services/displaySync.js').then(({ setDisplayState }) => {
      if (!window.__seatFocusBound) {
        document.addEventListener('click', (ev) => {
          const t = ev.target;
          const seat = t && t.closest ? t.closest('[data-seat-id]') : null;
          if (!seat) return;
          const sid = seat.getAttribute('data-seat-id');
          if (!sid) return;
          setDisplayState(tableId, { focusSeatId: sid, nonce: Date.now() });
        }, { capture: true });
        window.__seatFocusBound = true;
      }

      if (!window.__panelTabBound) {
        document.addEventListener('click', (ev) => {
          const t = ev.target && ev.target.closest
            ? ev.target.closest('[data-panel-tab], [data-tab]')
            : null;
          if (!t) return;
          const tab = t.getAttribute('data-panel-tab') || t.getAttribute('data-tab');
          if (!tab) return;
          setDisplayState(tableId, { activePanelTab: tab, nonce: Date.now() });
        }, { capture: true });
        window.__panelTabBound = true;
      }

      if (!window.__panelOpenObserver) {
        const side = document.querySelector('.side-panel');
        if (side) {
          const emit = () => {
            const open = side.classList.contains('is-open');
            setDisplayState(tableId, { panelOpen: open, nonce: Date.now() });
          };
          const mo = new MutationObserver(emit);
          mo.observe(side, { attributes: true, attributeFilter: ['class'] });
          emit();
          window.__panelOpenObserver = mo;
        }
      }
    });
  }

  const cleanup = () => {
    if (typeof unsubscribeSeats === 'function') unsubscribeSeats();
    stopSeatsRealtime();
    if (typeof unsubscribeTableData === 'function') unsubscribeTableData();
    if (typeof unsubscribeArrivals === 'function') unsubscribeArrivals();
    if (typeof unsubscribeWaiting === 'function') unsubscribeWaiting();
    if (typeof displayUnsub === 'function') displayUnsub();
    if (window.__panelOpenObserver) { try { window.__panelOpenObserver.disconnect(); } catch {} ; window.__panelOpenObserver = null; }
    if (enableTicker) stopPlayTimeTicker();
    removeBackToManagerButton();
  };
  window.addEventListener('beforeunload', cleanup, { once: true });
}

// ───────────── Modo Espejo ─────────────
async function openMirrorFlow () {
  const explicitId = getParam('table');
  const { db } = await import('./services/config/firebaseConfig.js');
  const { doc, getDoc } = await import('firebase/firestore');
  const getMesa = async (id) => {
    if (!id) return null;
    const snap = await getDoc(doc(db, 'tables', id));
    return snap.exists() ? ({ id: snap.id, ...snap.data() }) : null;
  };

  let mesa = explicitId ? await getMesa(explicitId) : null;
  if (!mesa) { try { mesa = await getActiveTable(); } catch {} }

  if (mesa) {
    setPageTitle(`Pantalla: ${mesa.name || 'Mesa'}`);
    const host = ensurePokerTableContainer();
    const msg = document.createElement('div');
    msg.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#fff;opacity:.8;font-weight:600;';
    msg.textContent = 'No hay mesa activa para mostrar.';
    host.appendChild(msg);
  }
}

// ───────────── Parallax opcional ─────────────
function addParallax (selector, maxTilt = 6) {
  document.querySelectorAll(selector).forEach(el => {
    let rect = null;
    const baseTransform = getComputedStyle(el).transform === 'none' ? '' : getComputedStyle(el).transform;
    const onMove = (e) => {
      rect = rect || el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      el.style.transform = `${baseTransform} rotateX(${-dy * maxTilt}deg) rotateY(${dx * maxTilt}deg) translateZ(0)`;
    };
    const onLeave = () => { rect = null; el.style.transform = baseTransform || 'none'; };
    el.style.transformStyle = 'preserve-3d';
    el.style.transition = 'transform .18s ease';
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
  });
}

// ───────────── Boot protegido por Auth ─────────────
async function runApp () {
  setFavicon('/branding/favicon.png');
  setPageTitle('Gestor de mesas');
  document.body.classList.add('theme-matte');

  const href = String(location.href);
  const path = String(location.pathname || '');
  const hash = String(location.hash || '');

  const isBridgeView =
    /[?&#](td3=1|bridge=1)\b/i.test(href) ||
    hash === '#/td3' ||
    /(^|\/)td3-bridge\/?$/.test(path);

  if (isBridgeView) {
    hideSplashScreen();
    setPageTitle('Bridge TD3');
    setBodyView('is-manager');
    renderTd3Bridge();
    return;
  }

  const isWaitingListView =
    /[?&#](view=lobby-waiting)\b/i.test(href);

  const isLobbyView =
    /[?&#](lobby=1)\b/i.test(href) ||
    /[?&#](view=lobby)\b/i.test(href) ||
    hash === '#/lobby' ||
    /(^|\/)lobby\/?$/.test(path);

if (isWaitingListView) {
  setPageTitle('Lista de Espera · Experience Poker');
  setBodyView('is-lobby');
  const { createRoot } = await import('react-dom/client');
  const { createElement } = await import('react');
  const { default: GeneralWaitingListApp } = await import('./GeneralWaitingListApp.jsx');
  const container = document.getElementById('app') || document.body;
  container.innerHTML = '';
  createRoot(container).render(createElement(GeneralWaitingListApp));
  return;
}

if (isLobbyView) {
  setPageTitle('Lobby · Experience Poker');
  setBodyView('is-lobby');
  // Montar React Lobby
  const { createRoot } = await import('react-dom/client');
  const { createElement } = await import('react');
  const { default: LobbyApp } = await import('./LobbyApp.jsx');
  const container = document.getElementById('app') || document.body;
  container.innerHTML = '';
  createRoot(container).render(createElement(LobbyApp));
  return;
}

  const tableParam = getParam('table');
  const viewParam = getParam('view');
  const mirrorFlag = getParam('mirror');
  const isMirror = (mirrorFlag === '1') || (viewParam === 'display');

  if (!tableParam) {
    setBodyView('is-manager');
    renderTablesManager();
    addParallax('.side-panel .panel-section.ios-elevate, .modal-content');
    return;
  }

  if (isMirror) {
    setBodyView('is-display');
    await openMirrorFlow();
    addParallax('.side-panel .panel-section.ios-elevate, .modal-content');
    return;
  }

  if (viewParam === 'display') {
    document.documentElement.classList.add('mirror-display-ready');
  }

  // Intentar cargar la mesa especificada en la URL
  try {
    const { db } = await import('./services/config/firebaseConfig.js');
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'tables', tableParam));
    
    if (snap.exists()) {
      // La mesa existe, cargarla normalmente
      const mesa = { id: snap.id, ...snap.data() };
      setActiveTableId(mesa.id);
      
      const status = mesa.status || 'inactive';
      const isActive = status === 'active' || status === 'activa';
      
      if (!isActive) {
        setBodyView('is-table-waiting');
        const { renderWaitingScreen } = await import('./components/table-waiting-screen.js');
        const container = document.getElementById('app') || document.body;
        container.innerHTML = '';
        renderWaitingScreen(mesa, container);
        addParallax('.side-panel .panel-section.ios-elevate, .modal-content');
        return;
      }
      
      setBodyView('is-table');
      initMainTableUI(mesa);
      addParallax('.side-panel .panel-section.ios-elevate, .modal-content');
      return;
    } else {
      // La mesa no existe en Firestore, pero la URL la especifica
      // Mostrar pantalla de espera con el nombre de la mesa
      setBodyView('is-table-waiting');
      const { renderWaitingScreen } = await import('./components/table-waiting-screen.js');
      const container = document.getElementById('app') || document.body;
      container.innerHTML = '';
      
      // Crear un objeto de mesa ficticio para la pantalla de espera
      const slotNumber = parseInt(tableParam.replace('Table-', ''), 10);
      const fakeMesa = {
        id: tableParam,
        name: tableParam,
        slotNumber: Number.isFinite(slotNumber) ? slotNumber : null,
        gameType: 'NLHE',
        smallBlind: 0,
        bigBlind: 0,
        maxSeats: 9,
        status: 'inactive',
      };
      renderWaitingScreen(fakeMesa, container);
      addParallax('.side-panel .panel-section.ios-elevate, .modal-content');
      return;
    }
  } catch (e) {
    console.warn('[main] Error al cargar mesa por URL:', e);
  }

  // Fallback: si no hay URL o falló todo, buscar mesa activa
  const mesaActiva = await getActiveTable();
  if (mesaActiva) {
    setActiveTableId(mesaActiva.id);
    
    const status = mesaActiva.status || 'inactive';
    const isActive = status === 'active' || status === 'activa';
    
    if (!isActive) {
      setBodyView('is-table-waiting');
      const { renderWaitingScreen } = await import('./components/table-waiting-screen.js');
      const container = document.getElementById('app') || document.body;
      container.innerHTML = '';
      renderWaitingScreen(mesaActiva, container);
      addParallax('.side-panel .panel-section.ios-elevate, .modal-content');
      return;
    }
    
    setBodyView('is-table');
    initMainTableUI(mesaActiva);
  } else {
    renderTablesManager();
  }

  addParallax('.side-panel .panel-section.ios-elevate, .modal-content');
  hideSplashScreen();
}

// ───────────── Entrada principal ─────────────
const IS_WAITING_LIST = /[?&#](view=lobby-waiting)\b/i.test(String(location.href));

const IS_LOBBY = (() => {
  const href = String(location.href);
  const path = String(location.pathname || '');
  const hash = String(location.hash || '');
  return (
    /[?&#](lobby=1)\b/i.test(href) ||
    /[?&#](view=lobby)\b/i.test(href) ||
    hash === '#/lobby' ||
    /(^|\/)lobby\/?$/.test(path)
  );
})();

document.addEventListener('DOMContentLoaded', () => {
  // --- Seguridad: Fallback para el Splash Screen ---
  // Si en 3 segundos no se ha quitado, lo forzamos.
  setTimeout(() => hideSplashScreen(0), 3000);

  // ── Montar React (modales de mesa) ──
  const tableAppContainer = document.createElement('div');
  tableAppContainer.id = 'table-react-root';
  document.body.appendChild(tableAppContainer);
  createRoot(tableAppContainer).render(createElement(TableApp));

if (IS_WAITING_LIST) {
  setFavicon('/branding/favicon.png');
  setPageTitle('Lista de Espera · Experience Poker');
  document.body.classList.add('theme-matte');
  setBodyView('is-lobby');
  Promise.all([
    import('react-dom/client'),
    import('react'),
    import('./GeneralWaitingListApp.jsx'),
  ]).then(([{ createRoot }, { createElement }, { default: GeneralWaitingListApp }]) => {
    const container = document.getElementById('app') || document.body;
    container.innerHTML = '';
    createRoot(container).render(createElement(GeneralWaitingListApp));
    hideSplashScreen(1000);
  });
  return;
}

if (IS_LOBBY) {
  setFavicon('/branding/favicon.png');
  setPageTitle('Lobby · Experience Poker');
  document.body.classList.add('theme-matte');
  setBodyView('is-lobby');
  // Montar React Lobby
  Promise.all([
    import('react-dom/client'),
    import('react'),
    import('./LobbyApp.jsx'),
  ]).then(([{ createRoot }, { createElement }, { default: LobbyApp }]) => {
    const container = document.getElementById('app') || document.body;
    container.innerHTML = '';
    createRoot(container).render(createElement(LobbyApp));
    hideSplashScreen(1000); // Un poco más de tiempo para el Lobby React
  });
  return;
}

  let authInitialized = false;
  watchAuth((user) => {
    const isFirstRun = !authInitialized;
    authInitialized = true;

    const needFullLogin = !user || user.isAnonymous || !user.email;
    if (needFullLogin) {
      hideVerifyEmail();
      showLogin();
      hideSplashScreen(0);
      return;
    }

    if (!user.emailVerified) {
      hideLogin();
      showVerifyEmail(user);
      hideSplashScreen(0);
      return;
    }

    hideVerifyEmail();
    hideLogin();
    runApp();
  });
});

// Helpers de consola
window.authWho = async () => {
  const { getAuth } = await import('firebase/auth');
  return getAuth().currentUser;
};
window.authSignOut = async () => {
  const { getAuth, signOut } = await import('firebase/auth');
  return signOut(getAuth());
};

// ==== DEBUG: botón "Hacerme admin" ====
(function mountMakeAdminButton () {
  const href = String(location.href);
  const hasDebug = /[?&#]debug=1\b/i.test(href);
  if (!hasDebug) return;

  const SET_ADMIN_URL = 'https://setadmin-it7r4vyplq-uc.a.run.app';

  const btn = document.createElement('button');
  btn.id = 'make-admin-btn';
  btn.type = 'button';
  btn.textContent = 'Hacerme admin';
  btn.style.cssText = `
    position:fixed; right:14px; bottom:64px; z-index:9999;
    padding:8px 12px; border-radius:999px; font:600 12px/1.2 Inter,system-ui,sans-serif;
    color:#0b1020; background:#b6ffbf; border:1px solid rgba(0,0,0,.08);
    box-shadow:0 8px 18px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.6);
    cursor:pointer;
  `;
  document.body.appendChild(btn);

  btn.addEventListener('click', async () => {
    try {
      const { getAuth } = await import('firebase/auth');
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) { alert('Primero inicia sesión (con correo).'); return; }
      if (!user.email) { alert('Tu sesión no tiene email.'); return; }

      const key = prompt('Key secreta (ADMIN_TOOL_KEY):', '');
      if (!key) return;

      const res = await fetch(SET_ADMIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key },
        body: JSON.stringify({ email: user.email }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        throw new Error(json.error || ('HTTP ' + res.status));
      }

      await user.getIdToken(true);
      alert('Listo. Ya tienes claim admin.\nRefresca la página si no ves los cambios.');
    } catch (err) {
      console.error('[make-admin]', err);
      alert('No se pudo asignar admin: ' + (err?.message || err));
    }
  });
})();