// src/pages/tables-manager.js
import './tables-manager.scss';
import '../components/table-settings-modal/table-form.scss';
import { listenTables, createTable, deleteTable, updateTable } from '../services/firebase/tableService.js';
import { listenGeneralWaitingList, addToWaitingList, removeFromWaitingList } from '../services/firebase/waitingListService.js';
import { addPendingArrival } from '../services/firebase/pendingArrivalsService.js';

const USE_LEGACY_FORM = false;
import { db } from '../services/config/firebaseConfig.js';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import * as TableFormMod from '../components/table-settings-modal/table-form.js';
import { openClosureModal } from '../ui/closure-modal.js';
import { openDailyClosureModal } from '../ui/daily-closure-modal.js';
import {
  listenAllPromotions,
  createPromotion,
  deletePromotion,
  togglePromotion,
} from '../services/firebase/promotionService.js';

// ─── Branding ───────────────────────────────────────────────────
const TM_BRAND = 'Skampa Poker Room';
function setPageTitle(title) {
  document.title = title ? `${title} – ${TM_BRAND}` : TM_BRAND;
}

// ─── Helpers DOM ────────────────────────────────────────────────
const qs  = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];
function getParam(k){ return new URLSearchParams(location.search).get(k); }

// ─── Estado runtime ─────────────────────────────────────────────
const _waitingList = [];
let _currentTab = 'tables'; // tracks active tab: 'tables' or 'waiting'
const _rowUnsubs     = new Map();
const _rowSeatUnsubs = new Map();
const _tableRuntime  = new Map();
const _seatRuntime   = new Map(); // id -> { occupied, total }
const _seatNotifications = []; // { id, tableId, tableName, dismissed }
let _tmTicker = null;
let _seatNotifyInterval = null;
let _allTables = []; // module-level cache for seat assignment

// ─── Helpers ────────────────────────────────────────────────────
async function handleTableSubmit(payload) {
  const created = await createTable(payload);
  const newId = typeof created === 'string' ? created : created?.id;
  if (newId) {
    const url = `${location.origin}${location.pathname}?table=${newId}`;
    navigator.clipboard.writeText(url).catch(() => {});
    const bc = new BroadcastChannel('poker-tables');
    bc.postMessage({ type: 'table-created', tableId: newId });
    const toast = document.createElement('div');
    toast.textContent = '✓ Mesa creada — link copiado al portapapeles';
    toast.style.cssText = `
      position:fixed; bottom:80px; left:50%; transform:translateX(-50%);
      background:rgba(48,209,88,.15); border:1px solid rgba(48,209,88,.3);
      color:#30d158; padding:10px 20px; border-radius:12px;
      font-size:13px; font-weight:600; z-index:9999;
      backdrop-filter:blur(10px);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
}

// ─── Tiempo helpers ─────────────────────────────────────────────
function tmFmtHMS(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return '00:00:00';
  const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}
function tmComputeElapsed(d) {
  const state         = d?.sessionState || 'idle';
  const startAt       = d?.sessionStartAt;
  const pausedTotalMs = Number(d?.pausedTotalMs || 0);
  const pauseStartAt  = d?.pauseStartedAt;

  let startMs = null;
  if (startAt) {
    if (typeof startAt.toMillis === 'function') startMs = startAt.toMillis();
    else if (typeof startAt === 'number') startMs = startAt;
    else if (startAt.seconds) startMs = startAt.seconds * 1000 + (startAt.nanoseconds || 0) / 1e6;
  }

  let pauseMs = null;
  if (pauseStartAt) {
    if (typeof pauseStartAt.toMillis === 'function') pauseMs = pauseStartAt.toMillis();
    else if (typeof pauseStartAt === 'number') pauseMs = pauseStartAt;
    else if (pauseStartAt.seconds) pauseMs = pauseStartAt.seconds * 1000 + (pauseStartAt.nanoseconds || 0) / 1e6;
  }

  if (!startMs) return 0;
  if (state === 'running') return Math.max(0, Math.floor((Date.now() - startMs - pausedTotalMs) / 1000));
  if (state === 'paused') return Math.max(0, Math.floor(((pauseMs || Date.now()) - startMs - pausedTotalMs) / 1000));
  return 0;
}

// ─── Ticker global ──────────────────────────────────────────────
function startManagerTicker() {
  if (_tmTicker) return;
  _tmTicker = setInterval(() => {
    document.querySelectorAll('.tm-row[data-id]').forEach(row => {
      const id = row.dataset.id;
      const d  = _tableRuntime.get(id);
      const el = row.querySelector('[data-field="timer"]');
      if (el) el.textContent = tmFmtHMS(tmComputeElapsed(d));
    });
    updateStats();
  }, 1000);
}
function stopManagerTicker() {
  if (_tmTicker) clearInterval(_tmTicker);
  _tmTicker = null;
}

// ─── Estadísticas ───────────────────────────────────────────────
function updateStats() {
  const rows = document.querySelectorAll('.tm-row[data-id]');
  let active = 0, players = 0, waiting = 0, totalSeats = 0, occupiedSeats = 0;

  rows.forEach(row => {
    const id     = row.dataset.id;
    const d      = _tableRuntime.get(id) || {};
    const seats  = _seatRuntime.get(id)  || { occupied: 0, total: 9 };
    const status = d.status || 'inactive';

    if (status === 'activa' || status === 'active') active++;
    players      += seats.occupied;
    waiting      += Number(d.waitingCount || 0);
    totalSeats   += seats.total;
    occupiedSeats+= seats.occupied;
  });

  const occ = totalSeats > 0 ? Math.round((occupiedSeats / totalSeats) * 100) : 0;

  const el = (id) => document.getElementById(id);
  if (el('tm-stat-active'))  el('tm-stat-active').textContent  = active;
  if (el('tm-stat-players')) el('tm-stat-players').textContent = players;
  if (el('tm-stat-waiting')) el('tm-stat-waiting').textContent = waiting;
  if (el('tm-stat-occ'))     el('tm-stat-occ').textContent     = `${occ}%`;
  if (el('tm-stat-sub'))     el('tm-stat-sub').textContent     = `de ${rows.length} en total`;
}

// ─── Live bind por fila ─────────────────────────────────────────
function bindRowLive(id, rowEl) {
  _rowUnsubs.get(id)?.();
  _rowSeatUnsubs.get(id)?.();

  const u1 = onSnapshot(doc(db, 'tables', id), (snap) => {
    if (!snap.exists()) return;
    const d = snap.data();
    _tableRuntime.set(id, d);

    // badge status
    const badge = rowEl.querySelector('.tm-status-badge');
    if (badge) {
      const st = d.status || 'inactive';
      badge.dataset.status = st;
      badge.textContent    = st === 'activa' || st === 'active' ? 'Activa'
                           : st === 'en-espera' ? 'En espera' : 'Inactiva';
      badge.className = `tm-status-badge ${
        st === 'activa' || st === 'active' ? 'badge-active'
        : st === 'en-espera' ? 'badge-waiting' : 'badge-inactive'
      }`;
    }

    // acento lateral
    const st = d.status || 'inactive';
    rowEl.classList.remove('row-active', 'row-waiting', 'row-inactive');
    rowEl.classList.add(
      st === 'activa' || st === 'active' ? 'row-active'
      : st === 'en-espera' ? 'row-waiting' : 'row-inactive'
    );

    // timer
    const timerEl = rowEl.querySelector('[data-field="timer"]');
    if (timerEl) timerEl.textContent = tmFmtHMS(tmComputeElapsed(d));

    // waiting
    const wEl = rowEl.querySelector('[data-field="waiting"]');
    if (wEl) {
      const wc = Number(d.waitingCount || 0);
      wEl.textContent = wc > 0 ? `⏳ ${wc} espera` : '';
      wEl.style.display = wc > 0 ? 'inline-flex' : 'none';
    }

    const gt = d.gameType || 'NLHE';
    const sb = Number(d.smallBlind || 0);
    const bb = Number(d.bigBlind || 0);
    // Desuscribir listener previo de waiting list para evitar fugas
    const oldU3 = _rowUnsubs.get(id + '_wl');
    if (oldU3) oldU3();
    const u3 = onSnapshot(
      query(
        collection(db, 'generalWaitingList'),
        where('gameType', '==', gt),
        where('smallBlind', '==', sb),
        where('bigBlind', '==', bb)
      ),
      (qsnap) => {
        const wc = qsnap.size;
        const d2 = _tableRuntime.get(id) || {};
        _tableRuntime.set(id, { ...d2, waitingCount: wc });
        const wEl = rowEl.querySelector('[data-field="waiting"]');
        if (wEl) {
          wEl.textContent = wc > 0 ? `⏳ ${wc} espera` : '';
          wEl.style.display = wc > 0 ? 'inline-flex' : 'none';
        }
      }
    );
    _rowUnsubs.set(id + '_wl', u3);
  });
  _rowUnsubs.set(id, u1);

  const u2 = onSnapshot(collection(db, 'tables', id, 'seats'), (qsnap) => {
    let occupied = 0;
    qsnap.forEach(snap => {
      const s   = snap.data();
      const st  = String(s?.status || 'available').toLowerCase();
      const isOcc = st === 'occupied'
        || !!(s?.name || s?.playerName || s?.player?.name)
        || Number(s?.chips || 0) > 0;
      if (isOcc) occupied++;
    });
    const tableDoc = _tableRuntime.get(id);
    const total = qsnap.size || Number(tableDoc?.maxSeats) || 9;
    _seatRuntime.set(id, { occupied, total });

    const seatsEl = rowEl.querySelector('[data-field="seats"]');
    if (seatsEl) seatsEl.textContent = `${occupied}/${total}`;

    const pct   = Math.round((occupied / total) * 100);
    const color = pct >= 90 ? '#ff453a' : pct >= 60 ? '#ffd60a' : '#30d158';
    const fill  = rowEl.querySelector('.tm-bar-fill');
    if (fill) { fill.style.width = `${pct}%`; fill.style.background = color; }

    // Refrescar lista de espera si está activa (ocupación de asientos cambió)
    if (_currentTab === 'waiting') renderWaitingList();
  });
  _rowSeatUnsubs.set(id, u2);

  startManagerTicker();
}

function cleanupLive() {
  _rowUnsubs.forEach(u => u?.());
  _rowSeatUnsubs.forEach(u => u?.());
  _rowUnsubs.forEach(u => u?.());
  _rowUnsubs.clear();
  _rowSeatUnsubs.clear();
  _tableRuntime.clear();
  _seatRuntime.clear();
  stopManagerTicker();
}

// ─── Modal helper ───────────────────────────────────────────────
function ensureOverlayInBody() {
  const SEL = '.tf-overlay, .table-form__overlay, .tm-modal-overlay';
  const move = () => document.querySelectorAll(SEL).forEach(el => {
    if (el.parentElement !== document.body) document.body.appendChild(el);
  });
  move();
  const obs = new MutationObserver(move);
  obs.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => obs.disconnect(), 2000);
}

async function openTableFormSafe(opts) {
  try {
    document.querySelectorAll('.tf-overlay,.table-form__overlay,.tm-modal-overlay').forEach(n => n.remove());
    let fn = TableFormMod.openTableForm;
    if (typeof fn !== 'function') {
      const mod = await import('../components/table-settings-modal/table-form.js');
      fn = mod.openTableForm;
    }
    if (typeof fn !== 'function') throw new Error('openTableForm no encontrado');
    document.body.classList.add('modal-open');
    const closeMaybe = await fn({
      ...opts,
      onClose: () => document.body.classList.remove('modal-open'),
    });
    const obs = new MutationObserver(() => {
      const opened = document.querySelector('.tf-overlay,.table-form__overlay');
      if (!opened) { document.body.classList.remove('modal-open'); obs.disconnect(); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return closeMaybe;
  } catch (e) {
    console.warn('[tables-manager] openTableFormSafe → fallback legacy:', e);
    document.body.classList.remove('modal-open');
    return openLegacyTableForm(opts);
  }
}

// ─── Form legacy ────────────────────────────────────────────────
function openLegacyTableForm({ mode = 'create', title = 'Mesa', initial = {}, onSubmit }) {
  const seed = {
    name:        initial?.name        ?? '',
    gameType:    initial?.gameType    ?? 'NLHE',
    smallBlind:  Number(initial?.smallBlind  ?? 25),
    bigBlind:    Number(initial?.bigBlind    ?? 50),
    minBuyIn:    Number(initial?.minBuyIn    ?? 1000),
    maxBuyIn:    Number(initial?.maxBuyIn    ?? 2000),
    maxSeats:    Number(initial?.maxSeats    ?? 9),
    status:      initial?.status      ?? 'inactive',
    publicLobby: Boolean(initial?.publicLobby ?? true),
    notes:       initial?.notes       ?? '',
  };
  const modal = document.createElement('div');
  modal.className = 'tm-modal-overlay';
  modal.innerHTML = `
    <div class="tm-modal glass-card legacy">
      <div class="tm-modal__header">
        <h3 class="glass-title">${title}</h3>
        <button class="tm-icon-btn" data-action="close" aria-label="Cerrar">×</button>
      </div>
      <div class="tm-modal__body grid-2">
        <label>Nombre<input id="f-name" type="text" placeholder="NLHE 1/2" value="${escapeHtml(seed.name)}"></label>
        <label>Tipo de juego
          <select id="f-game">
            <option value="NLHE" ${seed.gameType==='NLHE'?'selected':''}>NLHE</option>
            <option value="PLO"  ${seed.gameType==='PLO'?'selected':''}>PLO</option>
            <option value="MIX"  ${seed.gameType==='MIX'?'selected':''}>MIX</option>
          </select>
        </label>
        <label>Small Blind<input id="f-sb" type="number" min="0" value="${seed.smallBlind}"></label>
        <label>Big Blind<input id="f-bb" type="number" min="0" value="${seed.bigBlind}"></label>
        <label>Buy-in mínimo<input id="f-min" type="number" min="0" value="${seed.minBuyIn}"></label>
        <label>Buy-in máximo<input id="f-max" type="number" min="0" value="${seed.maxBuyIn}"></label>
        <label>Asientos<input id="f-seats" type="number" min="2" max="10" value="${seed.maxSeats}"></label>
        <label>Estado
          <select id="f-status">
            <option value="inactive" ${seed.status==='inactive'?'selected':''}>Stop</option>
            ${mode === 'edit' ? '<option value="active">Activa</option>' : ''}
            <option value="en-espera"${seed.status==='en-espera'?'selected':''}>En espera</option>
          </select>
        </label>
        <label class="span-2 checkbox">
          <input id="f-public" type="checkbox" ${seed.publicLobby?'checked':''}>
          <span>Visible en Lobby</span>
        </label>
      </div>
      <div class="tm-modal__footer right">
        <button class="tm-btn tm-btn--ghost" data-action="cancel">Cancelar</button>
        <button class="tm-btn tm-btn--primary" data-action="submit">${mode==='edit'?'Guardar':'Crear mesa'}</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  const $ = (sel) => modal.querySelector(sel);
  const close = () => modal.remove();
  modal.addEventListener('click', (e) => {
    if (e.target.matches('[data-action="close"],[data-action="cancel"]') || e.target === modal) close();
  });
  const escClose = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escClose); } };
  document.addEventListener('keydown', escClose);
  $('[data-action="submit"]').addEventListener('click', async () => {
    const payload = {
      name:        $('#f-name').value.trim(),
      gameType:    $('#f-game').value,
      smallBlind:  Number($('#f-sb').value  || 0),
      bigBlind:    Number($('#f-bb').value  || 0),
      minBuyIn:    Number($('#f-min').value || 0),
      maxBuyIn:    Number($('#f-max').value || 0),
      maxSeats:    Math.max(2, Math.min(10, Number($('#f-seats').value || 9))),
      status:      $('#f-status').value,
      publicLobby: $('#f-public').checked,
    };
    if (!payload.name)  { alert('Pon un nombre a la mesa.'); return; }
    if (!(payload.smallBlind > 0 && payload.bigBlind > 0)) { alert('Ciegas inválidas.'); return; }
try { await onSubmit?.(payload); close(); }
    catch (err) { console.error(err); alert('No se pudo guardar la mesa.'); }
  });
}

// ─── Helper: notificar llegada de jugador ─────────────────
async function executeSit(table, player) {
  try {
    await addPendingArrival(table.id, player);
    await removeFromWaitingList(player.id);
  } catch (e) {
    console.error('[pendingArrival]', e);
    alert('Error al notificar llegada: ' + e.message);
  }
}

function showTableSelectionPopup(candidates, player) {
  const overlay = document.createElement('div');
  overlay.className = 'tm-sit-overlay';
  overlay.innerHTML = `
    <div class="tm-sit-card">
      <h3>Elegir mesa para <strong>${escapeHtml(player.name)}</strong></h3>
      <p class="tm-sit-sub">${escapeHtml(player.gameType)} ${player.smallBlind}/${player.bigBlind}</p>
      <div class="tm-sit-list">
        ${candidates.map(t => {
          const si = _seatRuntime.get(t.id) || { occupied: 0, total: 9 };
          return `<button class="tm-sit-option" data-table-id="${t.id}">
            <span class="tm-sit-opt-name">${escapeHtml(t.name)}</span>
            <span class="tm-sit-opt-seats">${si.occupied}/${si.total} asientos</span>
          </button>`;
        }).join('')}
      </div>
      <button class="tm-sit-cancel">Cancelar</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelectorAll('.tm-sit-option').forEach(btn => {
    btn.addEventListener('click', async () => {
      const t = candidates.find(x => x.id === btn.dataset.tableId);
      if (!t) return;
      overlay.remove();
      await executeSit(t, player);
    });
  });
  overlay.querySelector('.tm-sit-cancel')?.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// ─── Espera Tab UI ───────────────────────────────────────
function renderWaitingScreen() {
  _currentTab = 'waiting';
  document.body.classList.add('auto-hide-session');
  setTimeout(() => document.body.classList.add('auto-hide-session'), 2500);
  setPageTitle('Lista de Espera');

  const app = document.getElementById('app') || document.body;
  let root = qs('.tables-manager');
  if (!root) {
    root = document.createElement('div');
    root.className = 'tables-manager';
    app.innerHTML = '';
    app.appendChild(root);
  }

  root.innerHTML = `
    <style>
      .tables-manager { min-height: 100vh; background: radial-gradient(ellipse 80% 40% at 50% 0%, rgba(212,175,55,.1), transparent 55%), #09090f; padding: 24px 20px 60px; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif; color: #fff; }
      .tm-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
      .tm-header h1 { font-size: 24px; font-weight: 700; color: #d4af37; letter-spacing: -.3px; margin: 0; }
      .tm-hdr-right { display:flex; gap:8px; align-items:center }
      .tm-waiting-form { margin-bottom: 20px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
      .tm-waiting-form input, .tm-waiting-form select { padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.05); color: #fff; font-family: inherit; }
      .tm-game-pills { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
      .tm-game-pill { flex:1; min-width:50px; padding:7px 4px; border-radius:8px; border:1px solid color-mix(in srgb, var(--pill-color) 30%, transparent); background:color-mix(in srgb, var(--pill-color) 8%, transparent); color:var(--pill-color); font-size:12px; font-weight:700; cursor:pointer; transition:all .15s; font-family:inherit; text-align:center; }
      .tm-game-pill:hover { background:color-mix(in srgb, var(--pill-color) 20%, transparent); }
      .tm-game-pill.active { background:color-mix(in srgb, var(--pill-color) 25%, transparent); box-shadow:0 0 12px color-mix(in srgb, var(--pill-color) 30%, transparent); }
      .tm-blinds-row { display:flex; gap:6px; align-items:center; flex-wrap:wrap; grid-column:span 2; }
      .tm-blind-pill { padding:6px 10px; border-radius:6px; border:1px solid rgba(255,255,255,.1); background:rgba(255,255,255,.04); color:rgba(255,255,255,.7); font-size:12px; font-weight:600; cursor:pointer; transition:all .12s; font-family:inherit; white-space:nowrap; }
      .tm-blind-pill:hover { background:rgba(212,175,55,.12); border-color:rgba(212,175,55,.3); }
      .tm-blind-pill.active { background:rgba(212,175,55,.18); border-color:#d4af37; color:#d4af37; box-shadow:0 0 10px rgba(212,175,55,.2); }
      .tm-list { display: flex; flex-direction: column; gap: 16px; }
      .tm-wait-group { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07); border-radius: 16px; overflow: hidden; }
      .tm-wait-group-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: rgba(255,255,255,.04); border-bottom: 1px solid rgba(255,255,255,.06); }
      .tm-wait-group-title { font-size: 15px; font-weight: 700; color: #d4af37; letter-spacing: .3px; }
      .tm-wait-group-count { font-size: 11px; color: rgba(255,255,255,.4); background: rgba(255,255,255,.06); padding: 2px 8px; border-radius: 99px; }
      .tm-wait-group-warn { font-size: 10px; color: #ff453a; margin-left: auto; font-weight: 600; letter-spacing: .5px; text-transform: uppercase; }
      .tm-wait-group-ready { font-size: 10px; color: #d4af37; margin-left: auto; font-weight: 600; letter-spacing: .5px; text-transform: uppercase; text-shadow: 0 0 12px rgba(212,175,55,.4); }
      .tm-wait-group-items { padding: 6px 0; }
      .tm-wait-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; transition: background .12s; }
      .tm-wait-item:hover { background: rgba(255,255,255,.04); }
      .tm-wait-item + .tm-wait-item { border-top: 1px solid rgba(255,255,255,.04); }
      .tm-wait-item-info { display: flex; flex-direction: column; gap: 2px; }
      .tm-wait-item-info strong { font-size: 14px; font-weight: 600; color: #fff; }
      .tm-wait-item-info small { font-size: 11px; color: rgba(255,255,255,.3); font-variant-numeric: tabular-nums; }
      .tm-wait-item-pos { width: 22px; height: 22px; border-radius: 99px; background: rgba(255,255,255,.06); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; color: rgba(255,255,255,.35); flex-shrink: 0; }
      .tm-wait-item-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
      .tm-group-tables { display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,.04); }
      .tm-group-table { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 99px; border: 1px solid color-mix(in srgb, var(--gt-color) 30%, transparent); background: color-mix(in srgb, var(--gt-color) 8%, transparent); font-size: 11px; font-weight: 600; color: var(--gt-color); letter-spacing: .3px; }
      .tm-gt-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--gt-color); flex-shrink: 0; }
      .tm-gt-occ { font-size: 10px; font-weight: 500; color: color-mix(in srgb, var(--gt-color) 60%, transparent); margin-left: 2px; }
      .tm-wait-actions { display: flex; gap: 4px; flex-shrink: 0; }
      .tm-wait-sit { padding: 4px 10px; background: linear-gradient(135deg,rgba(212,175,55,.18),rgba(212,175,55,.08)); border: 1px solid rgba(212,175,55,.3); color: #d4af37; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all .12s; font-family: inherit; }
      .tm-wait-sit:hover { background: linear-gradient(135deg,rgba(212,175,55,.28),rgba(212,175,55,.15)); }
      .tm-wait-remove { padding: 4px 8px; background: rgba(255,69,58,.08); border: 1px solid rgba(255,69,58,.2); color: #ff453a; border-radius: 6px; cursor: pointer; font-size: 11px; font-weight: 600; transition: all .12s; font-family: inherit; }
      .tm-wait-remove:hover { background: rgba(255,69,58,.15); }
      .tm-sit-overlay { position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,.7); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; padding:20px; }
      .tm-sit-card { background:#15151e; border:1px solid rgba(255,255,255,.1); border-radius:20px; width:min(400px,100%); padding:24px; box-shadow:0 40px 80px rgba(0,0,0,.6); }
      .tm-sit-card h3 { margin:0 0 4px; font-size:17px; font-weight:700; color:#fff; }
      .tm-sit-sub { margin:0 0 16px; font-size:13px; color:rgba(255,255,255,.4); }
      .tm-sit-list { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
      .tm-sit-option { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.04); color:#fff; cursor:pointer; font-family:inherit; font-size:13px; transition:all .12s; }
      .tm-sit-option:hover { background:rgba(212,175,55,.12); border-color:rgba(212,175,55,.3); }
      .tm-sit-opt-name { font-weight:600; }
      .tm-sit-opt-seats { font-size:11px; color:rgba(255,255,255,.4); }
      .tm-sit-cancel { width:100%; padding:10px; border-radius:12px; border:1px solid rgba(255,255,255,.08); background:transparent; color:rgba(255,255,255,.4); cursor:pointer; font-family:inherit; font-size:13px; transition:all .12s; }
      .tm-sit-cancel:hover { background:rgba(255,255,255,.06); color:#fff; }
      .tm-notif-area { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
      .tm-notif-item { display:flex; align-items:center; gap:10px; padding:10px 14px; border-radius:10px; background:rgba(251,191,36,.08); border:1px solid rgba(251,191,36,.25); font-size:13px; color:#fbbf24; animation:tmFadeIn .25s ease-out; }
      .tm-notif-item strong { color:#fff; font-weight:600; }
      .tm-notif-dismiss { margin-left:auto; padding:3px 10px; border-radius:6px; border:1px solid rgba(255,255,255,.15); background:rgba(255,255,255,.04); color:rgba(255,255,255,.4); cursor:pointer; font-family:inherit; font-size:11px; transition:all .12s; }
      .tm-notif-dismiss:hover { background:rgba(255,255,255,.1); color:#fff; }
      .tm-empty { padding:40px 20px; text-align:center; font-size:13px; color:rgba(255,255,255,.15); letter-spacing:1px; }
      .tm-wait-create-banner { display:flex; align-items:center; gap:10px; margin:0 16px 10px; padding:10px 14px; border-radius:10px; border:1px solid rgba(212,175,55,.35); background:linear-gradient(135deg,rgba(212,175,55,.12),rgba(212,175,55,.04)); color:#d4af37; font-size:13px; font-weight:600; cursor:pointer; transition:all .15s; }
      .tm-wait-create-banner:hover { background:linear-gradient(135deg,rgba(212,175,55,.22),rgba(212,175,55,.10)); box-shadow:0 0 20px rgba(212,175,55,.12); }
      .tm-wait-create-arrow { margin-left:auto; font-size:18px; opacity:.6; }
      @keyframes tmFadeIn{0%{opacity:0;transform:translateY(-6px)}100%{opacity:1;transform:translateY(0)}}
    </style>
    <div class="tm-header">
      <div>
        <h1>Lista de Espera General</h1>
        <div class="tm-header-sub">Staff controla la asignación · prioridad a mesas con menos jugadores</div>
      </div>
      <div class="tm-hdr-right">
        <button class="tm-btn-announce" id="tm-tables">🔙 Volver</button>
      </div>
    </div>
    <div id="tm-notif-area" class="tm-notif-area"></div>
    <div class="tm-waiting-form">
      <input id="w-name" type="text" placeholder="Nombre del jugador" style="grid-column: span 2;" />
      <div id="w-game-pills" class="tm-game-pills" style="grid-column: span 2;">
        <button class="tm-game-pill" data-game="NLHE" style="--pill-color:#30d158">NLHE</button>
        <button class="tm-game-pill" data-game="PLO"  style="--pill-color:#0a84ff">PLO</button>
        <button class="tm-game-pill" data-game="MAA"  style="--pill-color:#bf5af2">MAA</button>
        <button class="tm-game-pill" data-game="DCH"  style="--pill-color:#ff9f0a">DCH</button>
        <button class="tm-game-pill" data-game="V&V"  style="--pill-color:#ff375f">V&V</button>
      </div>
      <div id="w-blinds" class="tm-blinds-row" style="display:none"></div>
      <input id="w-sb" type="number" placeholder="SB" style="grid-column: span 1;" />
      <input id="w-bb" type="number" placeholder="BB" style="grid-column: span 1;" />
      <button id="w-add" style="grid-column: span 4; margin-top:4px; background:linear-gradient(135deg,rgba(212,175,55,.28),rgba(212,175,55,.12)); border:1px solid rgba(212,175,55,.4); color:#d4af37; padding:8px 12px; border-radius:8px; cursor:pointer; font-size:14px; font-weight:600;">+ Añadir a la lista</button>
    </div>
    <div class="tm-list" id="tm-wait-list"></div>
  `;

  qs('#tm-tables').addEventListener('click', () => {
    _currentTab = 'tables';
    if (_seatNotifyInterval) { clearInterval(_seatNotifyInterval); _seatNotifyInterval = null; }
    renderTablesManager();
  });

  // Pills de juego — selección
  const fmtInt = (n) => Number(n || 0).toLocaleString('es-MX');
  function updateBlindPills(game) {
    const container = qs('#w-blinds');
    const sbInput = qs('#w-sb');
    const bbInput = qs('#w-bb');
    // recoger blinds únicos de mesas con ese juego
    const pairs = new Map();
    (_allTables || []).forEach(t => {
      if ((t.gameType || '').toUpperCase() === game.toUpperCase()) {
        const key = `${t.smallBlind || 0}/${t.bigBlind || 0}`;
        if (!pairs.has(key)) pairs.set(key, { sb: Number(t.smallBlind || 0), bb: Number(t.bigBlind || 0) });
      }
    });
    const entries = [...pairs.values()];
    if (entries.length === 0) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }
    container.style.display = 'flex';
    container.innerHTML = entries.map((p, i) =>
      `<button class="tm-blind-pill" data-sb="${p.sb}" data-bb="${p.bb}">$${fmtInt(p.sb)}/$${fmtInt(p.bb)}</button>`
    ).join('');
    // click en blind → rellenar inputs y marcar activo
    qsa('.tm-blind-pill').forEach(b => {
      b.addEventListener('click', () => {
        qsa('.tm-blind-pill').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        sbInput.value = b.dataset.sb;
        bbInput.value = b.dataset.bb;
      });
    });
  }

  qsa('.tm-game-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('.tm-game-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // limpiar blind selection previa
      qsa('.tm-blind-pill').forEach(b => b.classList.remove('active'));
      qs('#w-sb').value = '';
      qs('#w-bb').value = '';
      updateBlindPills(btn.dataset.game);
    });
  });

  qs('#w-add').addEventListener('click', async () => {
    const name = qs('#w-name').value.trim();
    if (!name) return alert('Nombre requerido');
    const activePill = qs('.tm-game-pill.active');
    const game = activePill ? activePill.dataset.game : '';
    const sb = Number(qs('#w-sb').value);
    const bb = Number(qs('#w-bb').value);
    if (!game) return alert('Selecciona un juego');
    if (!(sb > 0 && bb > 0)) return alert('Ciegas inválidas');
    try {
      await addToWaitingList(name, '', game, sb, bb, '', '');
      qs('#w-name').value = '';
      qs('#w-sb').value = '';
      qs('#w-bb').value = '';
      qsa('.tm-game-pill').forEach(b => b.classList.remove('active'));
      qs('#w-blinds').style.display = 'none';
      qs('#w-blinds').innerHTML = '';
    } catch (e) { console.error(e); alert('Error al añadir'); }
  });

  renderWaitingList();

  // ─── Seat notification polling ───
  // initialize previous free-seat snapshot
  const _prevFree = new Map();
  _allTables.forEach(t => {
    const si = _seatRuntime.get(t.id) || { occupied: 0, total: 9 };
    _prevFree.set(t.id, si.total - si.occupied);
  });

  function renderNotifs() {
    const area = qs('#tm-notif-area');
    if (!area) return;
    const active = _seatNotifications.filter(n => !n.dismissed);
    if (!active.length) { area.innerHTML = ''; return; }
    area.innerHTML = active.map(n => `
      <div class="tm-notif-item">
        <span>🪑</span>
        <span><strong>${n.tableName}</strong> — Asiento disponible</span>
        <button class="tm-notif-dismiss" data-nid="${n.id}">Marcar leído</button>
      </div>
    `).join('');
    qsa('.tm-notif-dismiss').forEach(btn => {
      btn.addEventListener('click', () => {
        const n = _seatNotifications.find(x => x.id === btn.dataset.nid);
        if (n) n.dismissed = true;
        renderNotifs();
      });
    });
  }

  if (_seatNotifyInterval) clearInterval(_seatNotifyInterval);
  _seatNotifyInterval = setInterval(() => {
    _allTables.forEach(t => {
      const si = _seatRuntime.get(t.id) || { occupied: 0, total: 9 };
      const free = si.total - si.occupied;
      const prev = _prevFree.get(t.id) ?? -1;
      if (prev >= 0 && free > prev) {
        // seat(s) opened
        // avoid duplicates: if there's already an undismissed notification for this table, skip
        const already = _seatNotifications.some(n => !n.dismissed && n.tableId === t.id);
        if (!already) {
          _seatNotifications.push({
            id: `seat-${Date.now()}-${t.id}`,
            tableId: t.id,
            tableName: t.name || t.id || `Mesa ${t.slotNumber || ''}`,
            dismissed: false,
          });
          renderNotifs();
        }
      }
      _prevFree.set(t.id, free);
    });
  }, 2000);
}

function renderWaitingList() {
  const listEl = qs('#tm-wait-list');
  if (!listEl) return;
  if (!_waitingList.length) {
    listEl.innerHTML = '<div class="tm-empty">Sin jugadores en espera</div>';
    return;
  }

  // Agrupar por gameType + blinds
  const groups = {};
  _waitingList.forEach(item => {
    const key = `${item.gameType || 'NLHE'} ${item.smallBlind || 0}/${item.bigBlind || 0}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  listEl.innerHTML = Object.entries(groups).map(([groupKey, items]) => {
    const [gt, blinds] = groupKey.split(' ');
    const [sb, bb] = blinds.split('/').map(Number);
    const hasActiveTable = _allTables.some(t => {
      const mg = (t.gameType || '').toUpperCase() === gt.toUpperCase();
      const mb = Number(t.smallBlind) === sb && Number(t.bigBlind) === bb;
      const st = t.status || 'inactive';
      return mg && mb && (st === 'activa' || st === 'active');
    });
    const isReady = items.length >= 5;

    // Mesas de este grupo
    const groupTables = _allTables.filter(t => {
      const mg = (t.gameType || '').toUpperCase() === gt.toUpperCase();
      const mb = Number(t.smallBlind) === sb && Number(t.bigBlind) === bb;
      const st = String(t.status || '').toLowerCase();
      return mg && mb && (st === 'activa' || st === 'active' || st === 'en-espera');
    });

    return `<div class="tm-wait-group">
      <div class="tm-wait-group-header">
        <span class="tm-wait-group-title">${groupKey}</span>
        <span class="tm-wait-group-count">${items.length} jugador${items.length !== 1 ? 'es' : ''}</span>
        ${!hasActiveTable ? '<span class="tm-wait-group-warn">Sin mesa activa</span>' : ''}
        ${isReady && hasActiveTable ? '<span class="tm-wait-group-ready">✦ Mesa lista</span>' : ''}
      </div>
      ${items.length >= 6 ? `<div class="tm-wait-create-banner" data-game="${gt}" data-sb="${sb}" data-bb="${bb}" data-action="create-table">
        <span>✦</span>
        ${items.length} jugadores para armar mesa nueva (${groupKey})
        <span class="tm-wait-create-arrow">→</span>
      </div>` : ''}
      ${groupTables.length > 0 ? `<div class="tm-group-tables">
        ${groupTables.map(t => {
          const st = String(t.status || '').toLowerCase();
          const isAct = st === 'activa' || st === 'active';
          const si = _seatRuntime.get(t.id) || { occupied: 0, total: 9 };
          const label = t.slotNumber ? `MESA ${t.slotNumber}` : (t.name || t.id || '');
          return `<span class="tm-group-table" style="--gt-color:${isAct ? '#30d158' : '#fbbf24'}">
            <span class="tm-gt-dot"></span>
            ${label}
            ${isAct ? `<span class="tm-gt-occ">${si.occupied}/${si.total}</span>` : '<span class="tm-gt-occ">en espera</span>'}
          </span>`;
        }).join('')}
      </div>` : ''}
      <div class="tm-wait-group-items">
          ${items.map((item, i) => {
            const time = item.createdAt ? new Date(item.createdAt.seconds * 1000).toLocaleTimeString() : '';
            const tableLabel = item.slotNumber ? `MESA ${item.slotNumber}` : (item.tableName || '');
            return `<div class="tm-wait-item" data-id="${item.id}">
            <div class="tm-wait-item-left">
              <span class="tm-wait-item-pos">${i + 1}</span>
              <div class="tm-wait-item-info">
                ${tableLabel ? `<small style="color:rgba(212,175,55,.7);font-weight:600;letter-spacing:.5px;font-size:10px">${tableLabel}</small>` : ''}
                <strong>${escapeHtml(item.name)}</strong>
                <small>${time}</small>
              </div>
            </div>
            <div class="tm-wait-actions">
              ${hasActiveTable ? `<button class="tm-wait-sit" data-action="seat" data-id="${item.id}">Sentar</button>` : ''}
              <button class="tm-wait-remove" data-action="remove" data-id="${item.id}">Quitar</button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');

  qsa('[data-action="remove"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const docId = btn.dataset.id;
      try { await removeFromWaitingList(docId); } catch {}
    });
  });

  qsa('[data-action="seat"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const playerId = btn.dataset.id;
      const player = _waitingList.find(p => p.id === playerId);
      if (!player) { alert('Jugador no encontrado'); return; }

      // Buscar mesas activas del mismo juego/blind con asientos libres
      const candidates = _allTables.filter(t => {
        const mg = (t.gameType || '').toUpperCase() === (player.gameType || '').toUpperCase();
        const mb = Number(t.smallBlind) === Number(player.smallBlind) && Number(t.bigBlind) === Number(player.bigBlind);
        const st = t.status || 'inactive';
        const active = st === 'activa' || st === 'active';
        const si = _seatRuntime.get(t.id) || { occupied: 0, total: 9 };
        return active && mg && mb && si.occupied < si.total;
      });

      if (!candidates.length) {
        alert(`No hay mesa activa de ${player.gameType} ${player.smallBlind}/${player.bigBlind} con asientos libres.`);
        return;
      }

      // Ordenar por menor ocupación (las menos llenas primero)
      candidates.sort((a, b) => {
        const sa = _seatRuntime.get(a.id) || { occupied: 0 };
        const sb2 = _seatRuntime.get(b.id) || { occupied: 0 };
        return sa.occupied - sb2.occupied;
      });

      const minOcc = _seatRuntime.get(candidates[0].id)?.occupied ?? 0;
      const best = candidates.filter(t =>
        (_seatRuntime.get(t.id)?.occupied ?? 0) === minOcc
      );

      if (best.length === 1) {
        const target = best[0];
        const si = _seatRuntime.get(target.id) || { occupied: 0, total: 9 };
        if (confirm(`¿Sentar a ${player.name} en "${target.name}" (${si.occupied}/${si.total} asientos)?`)) {
          btn.disabled = true;
          btn.textContent = '...';
          await executeSit(target, player);
        }
      } else {
        showTableSelectionPopup(best, player);
      }
    });
  });

  // Banner "armar mesa nueva"
  qsa('[data-action="create-table"]').forEach(banner => {
    banner.addEventListener('click', () => {
      const game = banner.dataset.game;
      const sb = Number(banner.dataset.sb);
      const bb = Number(banner.dataset.bb);
      openTableFormSafe({
        mode: 'create',
        title: 'Nueva mesa',
        initial: { gameType: game, smallBlind: sb, bigBlind: bb },
        onSubmit: handleTableSubmit,
      });
    });
  });
}

function addWaitingTabButton() {
  const toolbar = qs('.tm-toolbar');
  if (!toolbar) return;
  const btn = document.createElement('button');
  btn.className = 'tm-btn-announce';
  btn.id = 'tm-waiting-tab';
  btn.textContent = '⏳ Espera';
  const badge = document.createElement('span');
  badge.id = 'tm-waiting-badge';
  badge.style.marginLeft = '4px';
  badge.style.color = '#d4af37';
  btn.appendChild(badge);
  toolbar.appendChild(btn);
  btn.addEventListener('click', renderWaitingScreen);
}

// ─── Render principal ───────────────────────────────────────────
export function renderTablesManager() {
  document.body.classList.add('auto-hide-session');
  setTimeout(() => document.body.classList.add('auto-hide-session'), 2500);
  document.querySelector('#session-pill')?.classList.add('compact');
  setPageTitle('Gestor de mesas');

  const app = document.getElementById('app') || document.body;
  let root  = qs('.tables-manager');
  if (!root) {
    root = document.createElement('div');
    root.className = 'tables-manager';
    app.innerHTML  = '';
    app.appendChild(root);
  }

  root.innerHTML = `
    <style>
      .tables-manager {
        min-height: 100vh;
        background: radial-gradient(ellipse 80% 40% at 50% 0%, rgba(212,175,55,.1), transparent 55%), #09090f;
        padding: 24px 20px 60px;
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
        color: #fff;
      }
      .tm-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
      .tm-header h1 { font-size: 24px; font-weight: 700; color: #d4af37; letter-spacing: -.3px; margin: 0; }
      .tm-header-sub { font-size: 11px; color: rgba(255,255,255,.3); letter-spacing: 1px; text-transform: uppercase; margin-top: 3px; }
      .tm-btn-new { height: 40px; padding: 0 18px; border-radius: 12px; background: linear-gradient(135deg, rgba(212,175,55,.28), rgba(212,175,55,.12)); border: 1px solid rgba(212,175,55,.4); color: #d4af37; font-size: 13px; font-weight: 600; cursor: pointer; transition: all .15s; }
      .tm-btn-new:hover { background: linear-gradient(135deg, rgba(212,175,55,.38), rgba(212,175,55,.2)); }
      .tm-btn-announce { height: 40px; padding: 0 16px; border-radius: 12px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12); color: rgba(255,255,255,.7); font-size: 13px; font-weight: 600; cursor: pointer; transition: all .15s; font-family: inherit; }
      .tm-btn-announce:hover { background: rgba(255,255,255,.1); color: #fff; border-color: rgba(255,255,255,.2); }
      .tm-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
      .tm-stat { background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.07); border-radius: 14px; padding: 14px 16px; }
      .tm-stat-label { font-size: 10px; letter-spacing: 1px; text-transform: uppercase; color: rgba(255,255,255,.28); margin-bottom: 6px; }
      .tm-stat-value { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1; }
      .tm-stat-sub { font-size: 11px; color: rgba(255,255,255,.28); margin-top: 4px; }
      .sv-green { color: #30d158; } .sv-gold { color: #d4af37; } .sv-amber { color: #ffd60a; } .sv-blue { color: #5ac8fa; }
      .tm-toolbar { display: flex; gap: 10px; margin-bottom: 16px; align-items: center; }
      .tm-search { flex: 1; height: 40px; border-radius: 12px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.05); color: #fff; padding: 0 14px; font-size: 13px; outline: none; font-family: inherit; }
      .tm-search::placeholder { color: rgba(255,255,255,.2); }
      .tm-search:focus { border-color: rgba(212,175,55,.4); background: rgba(255,255,255,.08); }
      .tm-filters { display: flex; gap: 6px; }
      .tm-filter { height: 34px; padding: 0 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,.1); background: transparent; color: rgba(255,255,255,.4); font-size: 12px; font-weight: 500; cursor: pointer; transition: all .15s; font-family: inherit; }
      .tm-filter.active { background: rgba(212,175,55,.12); border-color: rgba(212,175,55,.35); color: #d4af37; }
      .tm-filter:hover:not(.active) { background: rgba(255,255,255,.06); color: rgba(255,255,255,.7); }
      .tm-list { display: flex; flex-direction: column; gap: 8px; }
      .tm-row { background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07); border-radius: 16px; padding: 14px 16px; display: flex; align-items: center; gap: 14px; transition: background .15s; position: relative; overflow: hidden; cursor: default; }
      .tm-row::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; border-radius: 3px 0 0 3px; background: rgba(255,255,255,.12); }
      .tm-row.row-active::before { background: #30d158; box-shadow: 0 0 8px #30d15866; }
      .tm-row.row-waiting::before { background: #ffd60a; box-shadow: 0 0 8px #ffd60a66; }
      .tm-row.row-inactive::before { background: rgba(255,255,255,.15); }
      .tm-row:hover { background: rgba(255,255,255,.055); }
      .tm-row-name { font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 5px; }
      .tm-status-badge { font-size: 10px; font-weight: 700; letter-spacing: .8px; padding: 3px 8px; border-radius: 99px; text-transform: uppercase; display: inline-block; }
      .badge-active   { background: rgba(48,209,88,.15); color: #30d158; border: 1px solid rgba(48,209,88,.25); }
      .badge-waiting  { background: rgba(255,214,10,.15); color: #ffd60a; border: 1px solid rgba(255,214,10,.25); }
      .badge-inactive { background: rgba(255,255,255,.07); color: rgba(255,255,255,.4); border: 1px solid rgba(255,255,255,.1); }
      .tm-row-pills { display: flex; gap: 6px; flex: 1; flex-wrap: wrap; align-items: center; }
      .tm-pill { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); border-radius: 8px; padding: 4px 10px; font-size: 12px; color: rgba(255,255,255,.55); white-space: nowrap; }
      .tm-pill strong { color: #fff; font-weight: 600; }
      .tm-pill-waiting { background: rgba(255,214,10,.08); border-color: rgba(255,255,20,.2); color: #ffd60a; font-size: 11px; padding: 3px 8px; border-radius: 8px; }
      .tm-row-seats { display: flex; align-items: center; gap: 8px; min-width: 90px; }
      .tm-seats-text { font-size: 12px; color: rgba(255,255,255,.5); white-space: nowrap; }
      .tm-bar { width: 52px; height: 4px; border-radius: 99px; background: rgba(255,255,255,.08); overflow: hidden; }
      .tm-bar-fill { height: 100%; border-radius: 99px; background: #30d158; transition: width .4s, background .4s; }
      .tm-row-timer { font-size: 13px; font-variant-numeric: tabular-nums; color: #5ac8fa; min-width: 72px; font-weight: 600; font-family: monospace; }
      .tm-row-actions { display: flex; gap: 6px; }
      .tm-action { width: 34px; height: 34px; border-radius: 9px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.05); color: rgba(255,255,255,.5); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 15px; transition: all .15s; }
      .tm-action:hover { background: rgba(255,255,255,.12); color: #fff; border-color: rgba(255,255,255,.2); }
      .tm-action.danger:hover { background: rgba(255,69,58,.15); border-color: rgba(255,69,58,.3); color: #ff453a; }
      .tm-empty { text-align: center; padding: 50px 20px; color: rgba(255,255,255,.25); font-size: 14px; }
      .tm-empty-icon { font-size: 32px; margin-bottom: 10px; opacity: .4; }
      @media (max-width: 700px) {
        .tm-stats { grid-template-columns: repeat(2, 1fr); }
        .tm-toolbar { flex-wrap: wrap; }
        .tm-filters { flex-wrap: wrap; }
        .tm-row { flex-wrap: wrap; }
        .tm-row-timer { display: none; }
      }
    </style>

    <div class="tm-header">
      <div>
        <h1>Gestor de Mesas</h1>
        <div class="tm-header-sub">Skampa Poker Room</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="tm-btn-announce" id="tm-announce">📢 Anuncios</button>
        <button class="tm-btn-announce" id="tm-daily-closure">📊 Cierre del Día</button>
        <button class="tm-btn-new" id="tm-new">+ Nueva mesa</button>
      </div>
    </div>

    <div class="tm-stats">
      <div class="tm-stat">
        <div class="tm-stat-label">Mesas activas</div>
        <div class="tm-stat-value sv-green" id="tm-stat-active">0</div>
        <div class="tm-stat-sub" id="tm-stat-sub">de 0 en total</div>
      </div>
      <div class="tm-stat">
        <div class="tm-stat-label">Jugadores en sala</div>
        <div class="tm-stat-value sv-gold" id="tm-stat-players">0</div>
        <div class="tm-stat-sub">sentados ahora</div>
      </div>
      <div class="tm-stat">
        <div class="tm-stat-label">En espera</div>
        <div class="tm-stat-value sv-amber" id="tm-stat-waiting">0</div>
        <div class="tm-stat-sub">en lista de espera</div>
      </div>
      <div class="tm-stat">
        <div class="tm-stat-label">Ocupación</div>
        <div class="tm-stat-value sv-blue" id="tm-stat-occ">0%</div>
        <div class="tm-stat-sub">de capacidad total</div>
      </div>
    </div>

    <div class="tm-toolbar">
      <input class="tm-search" id="tm-search" placeholder="Buscar mesa...">
      <div class="tm-filters">
        <button class="tm-filter active" data-filter="all">Todas</button>
        <button class="tm-filter" data-filter="active">Activas</button>
        <button class="tm-filter" data-filter="en-espera">En espera</button>
        <button class="tm-filter" data-filter="inactive">Inactivas</button>
      </div>
    </div>

    <div class="tm-list" id="tm-list"></div>
  `;

  addWaitingTabButton();

  const listEl   = qs('#tm-list',   root);
  const searchEl = qs('#tm-search', root);
  let allRows    = [];
  let activeFilter = 'all';

  // Filtros
  qsa('.tm-filter', root).forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('.tm-filter', root).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.dataset.filter;
      renderList();
    });
  });

  // Nueva mesa
  qs('#tm-new', root).addEventListener('click', async () => {
    if (USE_LEGACY_FORM) {
      openLegacyTableForm({
        mode: 'create', title: 'Nueva mesa',
        onSubmit: handleTableSubmit,
      });
    } else {
      await openTableFormSafe({
        mode: 'create', title: 'Nueva mesa',
        initial: {},
        onSubmit: handleTableSubmit,
      });
    }
  });

  // Botón de anuncios
  qs('#tm-announce', root)?.addEventListener('click', () => openPromotionManager());

  // Botón Cierre del Día
  qs('#tm-daily-closure', root)?.addEventListener('click', () => openDailyClosureModal());

  // Escucha lista de espera general en tiempo real
  listenGeneralWaitingList((list) => {
    _waitingList.splice(0, _waitingList.length, ...list);
    if (_currentTab === 'waiting') {
      renderWaitingList();
    }
    const badge = qs('#tm-waiting-badge');
    if (badge) badge.textContent = _waitingList.length;
  });

  // Escucha mesas en tiempo real
  listenTables((rows) => {
    allRows = rows || [];
    _allTables = rows || []; // keep module-level cache in sync
    renderList();
  });

  searchEl.addEventListener('input', renderList);

  function renderList() {
    const q        = (searchEl.value || '').toLowerCase();
    const filtered = allRows.filter(r => {
      const matchSearch = (r.name || '').toLowerCase().includes(q);
      const st = r.status || 'inactive';
      const matchFilter =
        activeFilter === 'all'       ? true :
        activeFilter === 'active'    ? (st === 'active' || st === 'activa') :
        activeFilter === 'en-espera' ? st === 'en-espera' :
        activeFilter === 'inactive'  ? (st === 'inactive' || st === 'inactiva') :
        true;
      return matchSearch && matchFilter;
    });

    cleanupLive();

    if (!filtered.length) {
      listEl.innerHTML = `
        <div class="tm-empty">
          <div class="tm-empty-icon">♠</div>
          No hay mesas que mostrar
        </div>`;
      updateStats();
      return;
    }

    listEl.innerHTML = filtered.map((row) => {
      const min    = Number(row.minBuyIn ?? 0);
      const max    = Number(row.maxBuyIn ?? 0);
      const fmt    = (n) => n.toLocaleString('es-MX', { maximumFractionDigits: 0 });
      const st     = row.status || 'inactive';
      const rowCls = st === 'activa' || st === 'active' ? 'row-active'
                   : st === 'en-espera' ? 'row-waiting' : 'row-inactive';
      const badgeCls = st === 'activa' || st === 'active' ? 'badge-active'
                     : st === 'en-espera' ? 'badge-waiting' : 'badge-inactive';
      const badgeTxt = st === 'activa' || st === 'active' ? 'Activa'
                     : st === 'en-espera' ? 'En espera' : 'Inactiva';

      return `
        <div class="tm-row ${rowCls}" data-id="${row.id}">
          <div style="min-width:130px">
            <div class="tm-row-name">${row.name || '(sin nombre)'}</div>
            <span class="tm-status-badge ${badgeCls}" data-status="${st}">${badgeTxt}</span>
          </div>
          <div class="tm-row-pills">
            <div class="tm-pill"><strong>${row.gameType || 'NLHE'}</strong></div>
            <div class="tm-pill">${fmt(row.smallBlind ?? 0)}/${fmt(row.bigBlind ?? 0)}</div>
            <div class="tm-pill">$${fmt(min)}–$${fmt(max)}</div>
            <div class="tm-pill-waiting" data-field="waiting" style="display:none"></div>
          </div>
          <div class="tm-row-seats">
            <span class="tm-seats-text" data-field="seats">—/${row.maxSeats || 9}</span>
            <div class="tm-bar"><div class="tm-bar-fill" style="width:0%"></div></div>
          </div>
          <div class="tm-row-timer" data-field="timer">00:00:00</div>
          <div class="tm-row-actions">
            <button class="tm-action" title="Copiar link" data-action="copy">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            </button>
            <button class="tm-action" title="Abrir espejo" data-action="mirror">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            </button>
            <button class="tm-action" title="Editar" data-action="edit">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="tm-action" title="Cerrar Mesa" data-action="closure">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            </button>
            <button class="tm-action danger" title="Eliminar" data-action="delete">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </div>`;
    }).join('');

    qsa('.tm-row', listEl).forEach(rowEl => {
      const id = rowEl.dataset.id;

      rowEl.querySelector('[data-action="copy"]').addEventListener('click', () => {
        const url = `${location.origin}${location.pathname}?table=${id}`;
        navigator.clipboard.writeText(url).then(
          () => alert('Link copiado'),
          () => prompt('Copia el link:', url)
        );
      });

      rowEl.querySelector('[data-action="mirror"]').addEventListener('click', () => {
        window.open(`${location.origin}${location.pathname}?mirror=1&table=${id}`, '_blank');
      });

      rowEl.querySelector('[data-action="edit"]').addEventListener('click', async () => {
        const mesa = allRows.find(r => r.id === id);
        if (!mesa) return;
        if (USE_LEGACY_FORM) {
          openLegacyTableForm({ mode:'edit', title:'Editar mesa', initial: mesa,
            onSubmit: async (payload) => { await updateTable(id, payload); } });
        } else {
          await openTableFormSafe({ mode:'edit', title:'Editar mesa', initial: mesa,
            onSubmit: async (payload) => { await updateTable(id, payload); } });
        }
      });

      rowEl.querySelector('[data-action="delete"]').addEventListener('click', async () => {
        const confirmed = await showDeleteConfirmation(rowEl);
        if (!confirmed) return;
        try {
          // Apply delete animation
          rowEl.classList.add('deleting');
          // Wait for animation to complete
          await new Promise(resolve => setTimeout(resolve, 450));
          await deleteTable(id);
        }
        catch (e) {
          rowEl.classList.remove('deleting');
          alert('No se pudo eliminar la mesa.');
        }
      });

      rowEl.querySelector('[data-action="closure"]').addEventListener('click', () => {
        openClosureModal(id);
      });

      // También abrir la mesa al hacer clic en el nombre
      rowEl.querySelector('.tm-row-name').addEventListener('click', () => {
        location.href = `?table=${id}`;
      });
      rowEl.querySelector('.tm-row-name').style.cursor = 'pointer';
      rowEl.querySelector('.tm-row-name').title = 'Abrir mesa';

      bindRowLive(id, rowEl);
    });

    updateStats();
  }
}

// Arranque directo si se entra con ?manager=1
const isManager = getParam('manager') != null;
if (isManager) {
  document.addEventListener('DOMContentLoaded', () => renderTablesManager());
}

// ─── Delete Confirmation Modal ─────────────────────────────────
async function showDeleteConfirmation(rowEl) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'tm-confirm-overlay';

    const card = document.createElement('div');
    card.className = 'tm-confirm-card';

    card.innerHTML = `
      <div class="tm-confirm-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ff453a" stroke-width="2" stroke-linecap="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <h3>¿Eliminar esta mesa?</h3>
      <p>Esta acción no se puede deshacer.</p>
      <div class="tm-confirm-actions">
        <button class="tm-confirm-cancel">Cancelar</button>
        <button class="tm-confirm-delete">Eliminar</button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Trigger animations
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
      card.classList.add('visible');
    });

    const cleanup = (result) => {
      overlay.classList.remove('visible');
      overlay.classList.add('hiding');
      card.classList.add('hiding');
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 300);
    };

    card.querySelector('.tm-confirm-cancel').addEventListener('click', () => cleanup(false));
    card.querySelector('.tm-confirm-delete').addEventListener('click', () => cleanup(true));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cleanup(false);
    });
  });
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ─── Modal de Gestión de Anuncios ────────────────────────────────
function openPromotionManager() {
  document.querySelectorAll('.tm-promo-overlay').forEach(n => n.remove());

  const overlay = document.createElement('div');
  overlay.className = 'tm-promo-overlay';
  overlay.style.cssText = [
    'position:fixed;inset:0;z-index:9999;',
    'background:rgba(0,0,0,.75);backdrop-filter:blur(12px);',
    'display:flex;align-items:center;justify-content:center;padding:20px;',
  ].join('');

  const card = document.createElement('div');
  card.style.cssText = [
    'background:#111118;border:1px solid rgba(255,255,255,.1);border-radius:20px;',
    'width:min(520px,100%);max-height:80vh;overflow:hidden;',
    'display:flex;flex-direction:column;',
    'box-shadow:0 40px 80px rgba(0,0,0,.6);',
  ].join('');

  card.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 20px 0">
      <div>
        <h2 style="margin:0;font-size:18px;font-weight:700;color:#fff">📢 Anuncios</h2>
        <p style="margin:4px 0 0;font-size:12px;color:rgba(255,255,255,.35)">Visibles en el Lobby y en cada mesa</p>
      </div>
      <button id="tm-promo-close" style="width:32px;height:32px;border-radius:99px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:rgba(255,255,255,.6);cursor:pointer;font-size:16px;">✕</button>
    </div>
    <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,.07)">
      <div style="display:grid;grid-template-columns:44px 1fr;gap:8px;margin-bottom:8px">
        <input id="tm-promo-emoji" maxlength="4" placeholder="📢" style="border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font-size:22px;text-align:center;height:44px;outline:none;font-family:inherit;">
        <input id="tm-promo-title" placeholder="Título del anuncio" maxlength="60" style="border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font-size:14px;padding:0 12px;height:44px;outline:none;font-family:inherit;width:100%;box-sizing:border-box;">
      </div>
      <textarea id="tm-promo-body" placeholder="Descripción opcional..." maxlength="200" rows="2" style="width:100%;box-sizing:border-box;border-radius:10px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font-size:13px;padding:10px 12px;outline:none;resize:none;font-family:inherit;margin-bottom:8px;"></textarea>
      <div style="display:flex;gap:8px;align-items:center">
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:rgba(255,255,255,.5);cursor:pointer">
          <input type="checkbox" id="tm-promo-priority"> ⭐ Destacado
        </label>
        <button id="tm-promo-save" style="margin-left:auto;height:36px;padding:0 18px;border-radius:10px;background:linear-gradient(135deg,rgba(212,175,55,.28),rgba(212,175,55,.12));border:1px solid rgba(212,175,55,.4);color:#d4af37;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Publicar</button>
      </div>
    </div>
    <div id="tm-promo-list" style="overflow-y:auto;flex:1;padding:12px 20px;display:flex;flex-direction:column;gap:8px;">
      <div style="text-align:center;padding:20px;color:rgba(255,255,255,.25);font-size:13px">Cargando...</div>
    </div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  const listEl   = card.querySelector('#tm-promo-list');
  const emojiEl  = card.querySelector('#tm-promo-emoji');
  const titleEl  = card.querySelector('#tm-promo-title');
  const bodyEl   = card.querySelector('#tm-promo-body');
  const prioEl   = card.querySelector('#tm-promo-priority');
  const saveBtn  = card.querySelector('#tm-promo-save');

  const close = () => {
    unsub?.();
    overlay.remove();
  };
  card.querySelector('#tm-promo-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  function renderPromos(promos) {
    if (!promos.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(255,255,255,.25);font-size:13px">No hay anuncios. Crea el primero ↑</div>';
      return;
    }
    listEl.innerHTML = promos.map(p => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:${p.active ? 'rgba(255,255,255,.04)' : 'rgba(255,255,255,.02)'};border:1px solid ${p.active ? (p.priority > 0 ? 'rgba(212,175,55,.25)' : 'rgba(255,255,255,.08)') : 'rgba(255,255,255,.04)'};opacity:${p.active ? 1 : 0.5};">
        <span style="font-size:18px;line-height:1;flex-shrink:0">${escapeHtml(p.emoji || '📢')}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:600;color:${p.priority > 0 ? '#d4af37' : '#fff'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(p.title || '')}</div>
          ${p.body ? `<div style="font-size:11px;color:rgba(255,255,255,.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(p.body)}</div>` : ''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button data-action="toggle" data-id="${p.id}" data-active="${p.active}" style="width:32px;height:32px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:${p.active ? 'rgba(48,209,88,.1)' : 'rgba(255,255,255,.05)'};color:${p.active ? '#30d158' : 'rgba(255,255,255,.3)'};cursor:pointer;font-size:13px;">${p.active ? '●' : '○'}</button>
          <button data-action="delete" data-id="${p.id}" style="width:32px;height:32px;border-radius:8px;border:1px solid rgba(255,69,58,.2);background:rgba(255,69,58,.05);color:rgba(255,69,58,.6);cursor:pointer;font-size:13px;">✕</button>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('[data-action="toggle"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cur = btn.dataset.active === 'true';
        try { await togglePromotion(btn.dataset.id, !cur); } catch(e) { console.error(e); }
      });
    });
    listEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar este anuncio?')) return;
        try { await deletePromotion(btn.dataset.id); } catch(e) { console.error(e); }
      });
    });
  }

  let unsub;
  try { unsub = listenAllPromotions(renderPromos); } catch(e) { console.error(e); }

  saveBtn.addEventListener('click', async () => {
    const title = titleEl.value.trim();
    if (!title) { titleEl.focus(); titleEl.style.borderColor = '#ff453a'; return; }
    titleEl.style.borderColor = '';
    saveBtn.disabled = true;
    saveBtn.textContent = 'Publicando...';
    try {
      await createPromotion({
        title,
        body:     bodyEl.value.trim(),
        emoji:    emojiEl.value.trim() || '📢',
        priority: prioEl.checked ? 1 : 0,
      });
      titleEl.value = '';
      bodyEl.value = '';
      emojiEl.value = '';
      prioEl.checked = false;
    } catch(e) {
      console.error(e);
      alert('No se pudo crear el anuncio.');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '+ Publicar';
    }
  });
}