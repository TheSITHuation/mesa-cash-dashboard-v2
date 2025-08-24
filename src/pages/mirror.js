// src/pages/mirror.js
import { renderTable } from '../components/poker-table/poker-table.js';
import { destroyStartScreen } from '../components/start-screen/start-screen.js';
import { getActiveTable } from '../services/firebase/getActiveTable.js';

// util: lee ?param
function getParam(name) {
  const u = new URL(location.href);
  return u.searchParams.get(name);
}

// contenedor mínimo (igual que el de main)
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

// listeners directos (sin modales/panel)
async function listenTableAndSeats(tableId, onTable, onSeats) {
  const { db } = await import('../services/config/firebaseConfig.js');
  const { doc, onSnapshot, collection } = await import('firebase/firestore');

  const unsubTable = onSnapshot(doc(db, 'tables', tableId), (snap) => {
    onTable(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });

  const unsubSeats = onSnapshot(collection(db, 'tables', tableId, 'seats'), (qs) => {
    const seats = {};
    qs.forEach(d => seats[d.id] = d.data());
    onSeats(seats);
  });

  return () => { try { unsubTable(); } catch {} try { unsubSeats(); } catch {} };
}

export async function initMirrorPage() {
  // 1) quita overlays y aplica “cromo” de display
  destroyStartScreen();
  document.body.classList.add('mirror-chrome');

  // 2) resuelve qué mesa mostrar
  let tableId = getParam('table');
  if (!tableId) {
    const activa = await getActiveTable();
    if (!activa) {
      // si no hay mesa activa, muestra un aviso mínimo
      ensurePokerTableContainer();
      const warn = document.createElement('div');
      warn.style.cssText = 'color:#fff;text-align:center;opacity:.8;';
      warn.textContent = 'No hay mesa activa para mostrar.';
      document.querySelector('.poker-table-container').appendChild(warn);
      return;
    }
    tableId = activa.id;
  }

  // 3) asegura contenedor y arranca render espejo
  ensurePokerTableContainer();

  let currentTable = {};
  let currentSeats = {};
  const update = () => renderTable(currentTable, currentSeats);

  // 4) escuchas en tiempo real (solo mesa + asientos)
  const stop = await listenTableAndSeats(
    tableId,
    (t) => { currentTable = t || {}; update(); },
    (s) => { currentSeats = s || {}; update(); }
  );

  // limpia al salir
  window.addEventListener('beforeunload', () => { try { stop(); } catch {} });
}
