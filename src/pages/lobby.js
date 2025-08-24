// src/pages/lobby.js
import './lobby.scss';

import { listenTables } from '../services/firebase/tableService.js';
import { addToWaitingList } from '../services/firebase/waitingListService.js';
import { db } from '../services/config/firebaseConfig.js';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

// ───────────────────────────────────────────────────────────────────────────
// WhatsApp config (puedes mover estos valores a .env si quieres)
// ───────────────────────────────────────────────────────────────────────────
const WHATSAPP_PHONE = '+529931288300'; // <- tu número
const WHATSAPP_GREETING = 'Hola, quiero anotarme a la mesa'; // texto inicial

function sanitizePhoneE164(num) {
  // wa.me requiere sólo dígitos (con lada país), sin + ni espacios
  return String(num || '').replace(/[^\d]/g, '');
}
function moneyMXN(n) {
  return Number(n || 0).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0
  });
}
function buildWhatsAppUrl(tableRow) {
  const phone = sanitizePhoneE164(WHATSAPP_PHONE);
  if (!phone) return null;

  const name = tableRow?.name || 'Mesa';
  const game = tableRow?.gameType || 'NLHE';
  const sb   = Number(tableRow?.smallBlind ?? 0);
  const bb   = Number(tableRow?.bigBlind ?? 0);
  const min  = Number(tableRow?.minBuyIn ?? 0);
  const max  = Number(tableRow?.maxBuyIn ?? 0);

  const msg =
`${WHATSAPP_GREETING} ${name} (${game} ${sb}/${bb}).
Buy-in: ${moneyMXN(min)} – ${moneyMXN(max)}.
Mi nombre es: `;

  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

// Helpers DOM
const qs  = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => [...r.querySelectorAll(s)];

// Estado local de suscripciones por mesa
const seatUnsubs   = new Map();
const waitUnsubs   = new Map();

export function renderLobby() {
  const app = document.getElementById('app') || document.body;
  app.innerHTML = `
    <div class="lobby" style="--logo-url: url('/branding/logo-mark.svg')">
      <!-- Hero / Banner glass -->
      <header class="lobby__hero">
        <div class="lobby__hero-inner">
          <img class="lobby__logo" src="/branding/logo.png" alt="Skampa Poker" onerror="this.style.display='none'">
          <h1 class="lobby__title" aria-label="Skampa Poker">
            Skampa <span>Poker</span>
          </h1>
        </div>
      </header>

      <div class="lobby__list" id="lobby-list"></div>

      <!-- Modal jugadores -->
      <div class="lobby-modal" id="players-modal" hidden>
        <div class="lobby-modal__card">
          <h3 class="lobby-modal__title">Jugadores</h3>
          <ul id="players-list" class="players-list"></ul>
          <div class="modal-actions">
            <button id="close-players-modal" class="btn">Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  `;


  const listEl = qs('#lobby-list', app);
  const modal  = qs('#players-modal', app);
  qs('#close-players-modal', app).addEventListener('click', () => (modal.hidden = true));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') modal.hidden = true; });

  // Cierra suscripciones previas (si recargas la vista)
  seatUnsubs.forEach(fn => fn && fn()); seatUnsubs.clear();
  waitUnsubs.forEach(fn => fn && fn()); waitUnsubs.clear();

  // Escucha en tiempo real todas las mesas
  listenTables((rows) => {
    // Render base
    listEl.innerHTML = rows.map((t, i) => lobbyCardHTML(t, i)).join('');

    // Mapa por id para recuperar datos de cada tarjeta al hacer click
    const tableById = new Map(rows.map(r => [r.id, r]));

    // Por mesa, engancha realtime de seats y waitingList para contadores
    rows.forEach((t) => {
      // Seats
      if (seatUnsubs.get(t.id)) { seatUnsubs.get(t.id)(); seatUnsubs.delete(t.id); }
      const seatsRef = collection(db, 'tables', t.id, 'seats');
      const unsubS = onSnapshot(query(seatsRef, orderBy('seatNumber', 'asc')), (qsnap) => {
        let occupied = 0, names = [];
        qsnap.forEach(d => {
          const s = d.data();
          const st = String(s?.status || 'empty').toLowerCase();
          const isOcc = st === 'occupied' ||
                        Number(s?.chips ?? s?.player?.chips ?? 0) > 0 ||
                        !!(s?.name || s?.playerName || s?.player?.name);
          if (isOcc) {
            occupied++;
            const nm = s?.player?.name || s?.playerName || s?.name || 'Jugador';
            names.push(nm);
          }
        });
        const maxSeats = Number(t?.maxSeats ?? 9) || 9;
        const card = qs(`.lobby-card[data-id="${t.id}"]`);
        if (card) {
          qs('[data-field="players"]', card).textContent = `${occupied} / ${maxSeats}`;
          card.dataset.playerNames = JSON.stringify(names);
        }
      });
      seatUnsubs.set(t.id, unsubS);

      // Waiting list
      if (waitUnsubs.get(t.id)) { waitUnsubs.get(t.id)(); waitUnsubs.delete(t.id); }
      const wlRef = collection(db, 'tables', t.id, 'waitingList');
      const unsubW = onSnapshot(query(wlRef, orderBy('createdAt', 'asc')), (qsnap) => {
        const count = qsnap.size;
        const card = qs(`.lobby-card[data-id="${t.id}"]`);
        if (card) qs('[data-field="wait"]', card).textContent = `${count} ${count === 1 ? 'persona' : 'personas'}`;
      });
      waitUnsubs.set(t.id, unsubW);
    });

    // Wire de acciones por tarjeta
    qsa('.lobby-card', listEl).forEach((card) => {
      const id = card.dataset.id;

      // Ver jugadores
      qs('[data-action="view"]', card).addEventListener('click', () => {
        const modal = qs('#players-modal');
        const ul = qs('#players-list', modal);
        const names = JSON.parse(card.dataset.playerNames || '[]');
        ul.innerHTML = names.length
          ? names.map(n => `<li><span class="dot"></span>${n}</li>`).join('')
          : `<li class="muted">No hay jugadores sentados.</li>`;
        modal.hidden = false;
      });

      // Anotarme -> WhatsApp con mensaje prellenado; fallback: waiting list
      qs('[data-action="join"]', card).addEventListener('click', async () => {
        const row = tableById.get(id);
        const wa = buildWhatsAppUrl(row);

        if (wa) {
          window.open(wa, '_blank', 'noopener');
          return;
        }

        // Fallback si no hubiera número válido
        const name = prompt('Tu nombre para la lista de espera:')?.trim();
        if (!name) return;
        try {
          await addToWaitingList(name, id);
          alert('¡Listo! Te agregamos a la lista.');
        } catch (e) {
          console.error(e);
          alert('No pudimos anotarte, intenta más tarde.');
        }
      });
    });
  });
}

function lobbyCardHTML(t, i) {
  const status = (t.status || 'inactive').toLowerCase();
  const sb = Number(t.smallBlind ?? 0);
  const bb = Number(t.bigBlind ?? 0);
  const min = Number(t.minBuyIn ?? 0);
  const max = Number(t.maxBuyIn ?? 0);
  const game = t.gameType || 'NLHE';

  const money = (n) => n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

  return `
  <article class="lobby-card" data-id="${t.id}" style="--i:${i}" data-player-names="[]">
    <div class="lc-head">
      <h3 class="lc-title">${t.name || 'Mesa'}</h3>
      <span class="lc-status badge" data-status="${status}">${status}</span>
    </div>

    <div class="lc-row">
      ${ico('game')}
      <span class="lc-label">Juego:</span>
      <span class="lc-value">${game}</span>
    </div>

    <div class="lc-row">
      ${ico('blinds')}
      <span class="lc-label">Ciegas:</span>
      <span class="lc-value">${sb} / ${bb}</span>
    </div>

    <div class="lc-row">
      ${ico('buyin')}
      <span class="lc-label">Buy-in:</span>
      <span class="lc-value">${money(min)} – ${money(max)}</span>
    </div>

    <div class="lc-row">
      ${ico('players')}
      <span class="lc-label">Jugadores:</span>
      <span class="lc-value" data-field="players">0 / ${Number(t?.maxSeats ?? 9) || 9}</span>
    </div>

    <div class="lc-row">
      ${ico('hourglass')}
      <span class="lc-label">Espera:</span>
      <span class="lc-value" data-field="wait">0 personas</span>
    </div>

    <div class="lc-actions">
      <button class="btn btn-ghost" data-action="view">
        ${ico('eye')} <span>Ver Jugadores</span>
      </button>
      <button class="btn btn-primary" data-action="join">
        ${ico('whatsapp')} <span>Anotarme</span>
      </button>
    </div>
  </article>
  `;
}

function ico(name) {
  switch (name) {
    case 'game': return `<span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg></span>`;
    case 'blinds': return `<span class="ico"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg></span>`;
    case 'buyin': return `<span class="ico"><svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 11h10"/></svg></span>`;
    case 'players': return `<span class="ico"><svg viewBox="0 0 24 24"><path d="M18 20a6 6 0 0 0-12 0"/><circle cx="12" cy="8" r="4"/></svg></span>`;
    case 'hourglass': return `<span class="ico"><svg viewBox="0 0 24 24"><path d="M6 2h12v4a6 6 0 0 1-6 6 6 6 0 0 1-6-6z"/><path d="M6 22h12v-4a6 6 0 0 0-6-6 6 6 0 0 0-6 6z"/></svg></span>`;
    case 'eye': return `<span class="ico"><svg viewBox="0 0 24 24"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg></span>`;
    case 'whatsapp': return `<span class="ico"><svg viewBox="0 0 24 24"><path d="M20 11.5A8.5 8.5 0 1 1 11.5 3 8.5 8.5 0 0 1 20 11.5Z"/><path d="M7.5 19 6 22l3-1.5"/></svg></span>`;
    default: return '';
  }
}
