// src/pages/tables-manager.js
import './tables-manager.scss';
import {
  listenTables, createTable, deleteTable, updateTable
} from '../services/firebase/tableService.js';

import { db } from '../services/config/firebaseConfig.js';
import { doc, onSnapshot, collection } from 'firebase/firestore';

// ───────────────────────────────── Branding ─────────────────────────────────
const TM_BRAND = 'Skampa Poker Room';
function setPageTitle(title) {
  document.title = title ? `${title} – ${TM_BRAND}` : TM_BRAND;
}

// ───────────────────────────────── Helpers DOM ─────────────────────────────
function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return [...root.querySelectorAll(sel)]; }
function getParam(k) { return new URLSearchParams(location.search).get(k); }

// ───────────────────── Estado runtime para timers/listeners ───────────────
const _rowUnsubs = new Map();      // id -> () => void (mesa)
const _rowSeatUnsubs = new Map();  // id -> () => void (seats)
const _tableRuntime = new Map();   // id -> último doc de mesa (p/timer)
let _tmTicker = null;

// ───────────────────────────── Tiempo (helpers) ───────────────────────────
function tmFmtHMS(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00:00';
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}
function tmComputeElapsed(d) {
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
  return 0;
}

// ───────────────────────── Ticker global del manager ──────────────────────
function startManagerTicker() {
  if (_tmTicker) return;
  _tmTicker = setInterval(() => {
    document.querySelectorAll('.tm-card [data-field="timer"]').forEach(el => {
      const id = el.closest('.tm-card')?.dataset.id;
      const d = _tableRuntime.get(id);
      el.textContent = tmFmtHMS(tmComputeElapsed(d));
    });
  }, 1000);
}
function stopManagerTicker() {
  if (_tmTicker) clearInterval(_tmTicker);
  _tmTicker = null;
}

// ───────────────────────── Bind live por tarjeta ──────────────────────────
function bindRowLive(id, cardEl) {
  // limpia previos
  _rowUnsubs.get(id)?.();
  _rowSeatUnsubs.get(id)?.();

  // 1) Doc de mesa → status + timer inmediato
  const u1 = onSnapshot(doc(db, 'tables', id), (snap) => {
    if (!snap.exists()) return;
    const d = snap.data();
    _tableRuntime.set(id, d);

    const statusBadge = cardEl.querySelector('.badge[data-status]');
    if (statusBadge) {
      const st = d.status || 'inactive';
      statusBadge.dataset.status = st;
      statusBadge.textContent = st.replace('en-espera','en espera').replace('inactive','inactiva');
    }

    const timerEl = cardEl.querySelector('[data-field="timer"]');
    if (timerEl) timerEl.textContent = tmFmtHMS(tmComputeElapsed(d));
  });
  _rowUnsubs.set(id, u1);

  // 2) Subcolección seats → ocupados/libres
  const u2 = onSnapshot(collection(db, 'tables', id, 'seats'), (qsnap) => {
    let total = 0, occupied = 0;
    qsnap.forEach(snap => {
      total++;
      const s = snap.data();
      const st = String(s?.status || 'available').toLowerCase();
      const isOcc = st === 'occupied'
        || !!(s?.name || s?.playerName || s?.player?.name)
        || Number(s?.chips || 0) > 0;
      if (isOcc) occupied++;
    });
    total = Math.max(total, 9); // UX: si faltan docs, asumimos 9
    const free = Math.max(0, total - occupied);
    const seatsEl = cardEl.querySelector('[data-field="seats"]');
    if (seatsEl) seatsEl.textContent = `${free}/${total} libres`;
  });
  _rowSeatUnsubs.set(id, u2);

  startManagerTicker();
}

function cleanupLive() {
  _rowUnsubs.forEach(u => u && u());
  _rowSeatUnsubs.forEach(u => u && u());
  _rowUnsubs.clear();
  _rowSeatUnsubs.clear();
  _tableRuntime.clear();
  stopManagerTicker();
}

// ───────────────────────────── Render principal ───────────────────────────
export function renderTablesManager() {
  setPageTitle('Gestor de mesas');

  const app = document.getElementById('app') || document.body;

  let root = qs('.tables-manager');
  if (!root) {
    root = document.createElement('div');
    root.className = 'tables-manager';
    app.innerHTML = '';
    app.appendChild(root);
  }

  root.innerHTML = `
    <div class="tm-header">
      <h1>Mesas</h1>
      <button class="tm-btn tm-btn--primary" id="tm-new">Nueva mesa</button>
    </div>

    <div class="tm-filters">
      <input id="tm-search" class="tm-input" placeholder="Buscar por nombre…">
      <!-- Si quieres vista lista: aplica clase 'rows' al contenedor de abajo -->
    </div>

    <div class="tm-list" id="tm-list"></div>

    <!-- Modal Crear/Editar -->
    <div class="tm-modal" id="tm-modal" hidden>
      <div class="tm-modal__card">
        <h3 id="tm-modal-title">Nueva mesa</h3>
        <form id="tm-form">
          <div class="row">
            <label>Nombre</label>
            <input name="name" required placeholder="NLHE 1/2">
          </div>

          <div class="row">
            <label for="tm-gameType">Tipo de juego</label>
            <select id="tm-gameType" name="gameType" required>
              <option value="NLHE" selected>NLHE</option>
              <option value="PLO">PLO</option>
              <option value="Mata Ases">Mata Ases</option>
              <option value="DCH">DCH</option>
            </select>
          </div>

          <div class="row two">
            <div>
              <label>Small Blind</label>
              <input name="smallBlind" type="number" min="0" step="1" value="25">
            </div>
            <div>
              <label>Big Blind</label>
              <input name="bigBlind" type="number" min="0" step="1" value="50">
            </div>
          </div>

          <div class="row two">
            <div>
              <label>Buy-in mínimo</label>
              <input name="minBuyIn" type="number" min="0" step="50" value="1000">
            </div>
            <div>
              <label>Buy-in máximo</label>
              <input name="maxBuyIn" type="number" min="0" step="50" value="5000">
            </div>
          </div>

          <div class="row">
            <label>Estado</label>
            <select name="status">
              <option value="inactive" selected>inactive</option>
              <option value="active">active</option>
              <option value="en-espera">en-espera</option>
            </select>
          </div>

          <div class="actions">
            <button type="button" class="tm-btn" id="tm-cancel">Cancelar</button>
            <button type="submit" class="tm-btn tm-btn--primary" id="tm-submit">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const listEl   = qs('#tm-list', root);
  const searchEl = qs('#tm-search', root);

  // estado edición modal
  let editingId = null;
  const closeModal = () => { qs('#tm-modal').hidden = true; editingId = null; };
  const openCreate = () => {
    editingId = null;
    qs('#tm-modal-title').textContent = 'Nueva mesa';
    const f = /** @type {HTMLFormElement} */(qs('#tm-form'));
    f.reset();
    f.name.value = '';
    f.gameType.value = 'NLHE';
    f.smallBlind.value = 25;
    f.bigBlind.value = 50;
    f.minBuyIn.value = 1000;
    f.maxBuyIn.value = 5000;
    f.status.value = 'inactive';
    qs('#tm-modal').hidden = false;
  };
  const openEdit = (mesa) => {
    editingId = mesa.id;
    qs('#tm-modal-title').textContent = 'Editar mesa';
    const f = /** @type {HTMLFormElement} */(qs('#tm-form'));
    f.name.value       = mesa.name || '';
    f.gameType.value   = mesa.gameType || 'NLHE';
    f.smallBlind.value = mesa.smallBlind ?? 25;
    f.bigBlind.value   = mesa.bigBlind ?? 50;
    f.minBuyIn.value   = mesa.minBuyIn ?? 1000;
    f.maxBuyIn.value   = mesa.maxBuyIn ?? 5000;
    f.status.value     = mesa.status || 'inactive';
    qs('#tm-modal').hidden = false;
  };

  // acciones cabecera
  qs('#tm-new').addEventListener('click', openCreate);
  qs('#tm-cancel').addEventListener('click', closeModal);

  // submit crear/editar
  qs('#tm-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = /** @type {HTMLFormElement} */ (e.currentTarget);
    const fd = new FormData(form);

    const payload = {
      name: (fd.get('name') || '').toString().trim(),
      gameType: (fd.get('gameType') || 'NLHE').toString(),
      smallBlind: Number(fd.get('smallBlind') || 0),
      bigBlind: Number(fd.get('bigBlind') || 0),
      minBuyIn: Number(fd.get('minBuyIn') || 0),
      maxBuyIn: Number(fd.get('maxBuyIn') || 0),
      status: (fd.get('status') || 'inactive').toString(),
      active: false,
    };

    if (!payload.name) { alert('Pon un nombre a la mesa'); return; }
    if (payload.smallBlind <= 0 || payload.bigBlind <= 0) {
      alert('Los blinds deben ser > 0'); return;
    }

    try {
      if (editingId) {
        await updateTable(editingId, payload);
        closeModal();
      } else {
        const created = await createTable(payload);
        const newId = typeof created === 'string' ? created : created?.id;
        if (newId) {
          location.href = `?table=${newId}`;
          return;
        }
        closeModal();
      }
    } catch (err) {
      console.error('[tm] Guardar mesa error', err);
      alert('No se pudo guardar la mesa.');
    }
  });

  // escucha mesas
  let allRows = [];
  listenTables((rows) => {
    allRows = rows || [];
    renderList();
  });

  // filtro
  searchEl.addEventListener('input', renderList);

  function renderList() {
    const q = (searchEl.value || '').toLowerCase();
    const filtered = q
      ? allRows.filter(r => (r.name || '').toLowerCase().includes(q))
      : allRows;

    // limpia listeners anteriores
    cleanupLive();

    listEl.innerHTML = filtered.map((row, idx) => {
      const min = Number(row.minBuyIn ?? 0);
      const max = Number(row.maxBuyIn ?? 0);
      const fmtMoney = (n) => n.toLocaleString('es-MX', { maximumFractionDigits: 0 });

      return `
        <div class="tm-card" data-id="${row.id}" style="--i:${idx}">
          <div>
            <div class="tm-title">${row.name || '(sin nombre)'}</div>
            <div class="tm-meta">
              <span class="badge" data-status="${row.status || 'inactive'}">
                ${(row.status || 'inactive').replace('en-espera','en espera').replace('inactive','inactiva')}
              </span>
              <span class="badge">${row.smallBlind ?? 0}/${row.bigBlind ?? 0}</span>
              <span class="badge">$${fmtMoney(min)}–$${fmtMoney(max)}</span>
              ${row.gameType ? `<span class="badge">${row.gameType}</span>` : ''}
              <span class="badge" data-field="timer">00:00:00</span>
              <span class="badge" data-field="seats">—/9 libres</span>
            </div>
          </div>
          <div class="tm-actions">
            <button class="tm-icon-btn" title="Copiar link" data-action="copy">🔗</button>
            <button class="tm-icon-btn" title="Abrir espejo" data-action="mirror">🖥️</button>
            <button class="tm-icon-btn" title="Editar" data-action="edit">✏️</button>
            <button class="tm-icon-btn danger" title="Eliminar" data-action="delete">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    // eventos por tarjeta + binding en vivo
    qsa('.tm-card', listEl).forEach(card => {
      const id = card.dataset.id;

      card.querySelector('[data-action="copy"]')
        .addEventListener('click', () => copyLink(id));

      card.querySelector('[data-action="mirror"]')
        .addEventListener('click', () => openMirror(id));

      card.querySelector('[data-action="edit"]')
        .addEventListener('click', () => {
          const mesa = allRows.find(r => r.id === id);
          if (mesa) openEdit(mesa);
        });

      card.querySelector('[data-action="delete"]')
        .addEventListener('click', async () => {
          if (!confirm('¿Eliminar esta mesa?')) return;
          try { await deleteTable(id); } catch (e) { alert('No se pudo eliminar.'); }
        });

      bindRowLive(id, card);
    });
  }

  function copyLink(id) {
    const url = `${location.origin}${location.pathname}?table=${id}`;
    navigator.clipboard.writeText(url).then(
      () => alert('Link copiado'),
      () => prompt('Copia el link:', url)
    );
  }
  function openMirror(id) {
    const url = `${location.origin}${location.pathname}?mirror=1&table=${id}`;
    window.open(url, '_blank');
  }
}

// Arranque directo si se entra con ?manager=1
const isManager = getParam('manager') != null;
if (isManager) {
  document.addEventListener('DOMContentLoaded', () => renderTablesManager());
}
