// src/components/waiting-list/waiting-list.js
import { db } from '../../services/config/firebaseConfig.js';
import { addToWaitingList, removeFromWaitingList } from '../../services/firebase/waitingListService.js';
import { collection, onSnapshot, orderBy, query, where, doc } from 'firebase/firestore';

const qs = (s, r = document) => r.querySelector(s);

export function initWaitingList(tableId) {
  const section = document.getElementById('waiting-list-section') || qs('.waiting-list-section');
  if (!section) return () => {};

  const form       = document.getElementById('add-player-form');
  const input      = document.getElementById('player-name-input');
  const btnSubmit  = document.getElementById('confirm-add-player-btn');
  const wlAddBtn   = document.getElementById('wl-add-btn');
  const countBadge = document.getElementById('wl-count-badge');
  const listEl     = document.getElementById('waiting-list');

  // ── Toggle formulario ──────────────────────────────────────
  if (wlAddBtn && !wlAddBtn._bound) {
    wlAddBtn._bound = true;
    wlAddBtn.addEventListener('click', () => {
      if (!form) return;
      const hidden = form.classList.contains('hidden');
      form.classList.toggle('hidden', !hidden);
      if (hidden && input) input.focus();
    });
  }

  // ── Submit agregar jugador ─────────────────────────────────
  if (form && !form.dataset.bound) {
    form.dataset.bound = '1';

    const doAdd = async () => {
      const name = (input?.value || '').trim();
      if (!name) return;
      if (form.dataset.busy === '1') return;
      form.dataset.busy = '1';
      if (btnSubmit) btnSubmit.disabled = true;
      if (input)    input.disabled    = true;
      try {
        await addToWaitingList(name, tableId);
        if (input) input.value = '';
        form.classList.add('hidden');
        if (input) input.focus();
      } catch (err) {
        console.error('[waiting-list] add error:', err);
        alert(err?.message || 'No se pudo agregar a la lista');
      } finally {
        form.dataset.busy = '0';
        if (btnSubmit) btnSubmit.disabled = false;
        if (input)    input.disabled    = false;
      }
    };

    form.addEventListener('submit', (e) => { e.preventDefault(); doAdd(); });
    if (btnSubmit) btnSubmit.addEventListener('click', doAdd);

    // Enter en el input
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); doAdd(); }
      });
    }
  }

  // ── Limpia suscripción previa ──────────────────────────────
  if (section._unsub) {
    try { section._unsub(); } catch {}
    section._unsub = null;
  }

  if (!listEl) return () => {};

  // Escuchar la mesa para obtener gameType y blinds, y luego filtrar la lista de espera general
  let wlUnsub = null;

  const tableRef = doc(db, 'tables', tableId);
  const tableUnsub = onSnapshot(tableRef, (tableSnap) => {
    if (!tableSnap.exists()) return;
    const tableData = tableSnap.data();
    const gt = tableData.gameType || 'NLHE';
    const sb = Number(tableData.smallBlind || 0);
    const bb = Number(tableData.bigBlind || 0);

    if (wlUnsub) {
      wlUnsub();
      wlUnsub = null;
    }

    const q = query(
      collection(db, 'generalWaitingList'),
      where('gameType', '==', gt),
      where('smallBlind', '==', sb),
      where('bigBlind', '==', bb),
      orderBy('createdAt', 'asc')
    );

    wlUnsub = onSnapshot(q, (qsnap) => {
      const items = [];
      qsnap.forEach((doc) => {
        const d    = doc.data() || {};
        const name = d.name || '(Sin nombre)';
        const id   = doc.id;
        items.push({ id, name });
      });

      // Actualizar badge contador
      if (countBadge) countBadge.textContent = items.length;

      // Renderizar lista (DOM API para evitar XSS con nombres de Firestore)
      listEl.replaceChildren();
      if (!items.length) {
        const empty = document.createElement('li');
        empty.className = 'wl-empty-new';
        empty.textContent = 'No hay jugadores en espera';
        listEl.appendChild(empty);
        return;
      }

      items.forEach((item, i) => {
        const li = document.createElement('li');
        li.className = 'wl-item-new';
        li.dataset.id = item.id;
        li.dataset.name = item.name;

        const num = document.createElement('span');
        num.className = 'wl-item-num';
        num.textContent = String(i + 1);

        const dot = document.createElement('span');
        dot.className = 'wl-item-dot';

        const name = document.createElement('span');
        name.className = 'wl-item-name';
        name.textContent = item.name;

        const sitBtn = document.createElement('button');
        sitBtn.className = 'wl-item-sit';
        sitBtn.dataset.action = 'sit';
        sitBtn.type = 'button';
        sitBtn.title = 'Sentar jugador';
        sitBtn.setAttribute('aria-label', `Sentar a ${item.name}`);
        sitBtn.textContent = 'Sentar';

        const removeBtn = document.createElement('span');
        removeBtn.className = 'wl-item-remove';
        removeBtn.dataset.action = 'remove';
        removeBtn.setAttribute('role', 'button');
        removeBtn.setAttribute('tabindex', '0');
        removeBtn.setAttribute('aria-label', `Quitar a ${item.name} de la lista`);
        removeBtn.title = 'Quitar de lista';
        removeBtn.textContent = '×';

        li.append(num, dot, name, sitBtn, removeBtn);
        listEl.appendChild(li);
      });

      // ── Delegación de eventos ────────────────────────────────
      listEl.onclick = async (ev) => {
        const target = ev.target;

        // Quitar de lista
        if (target.closest('[data-action="remove"]')) {
          const li  = target.closest('.wl-item-new');
          const pid = li?.dataset.id;
          if (!pid) return;
          try {
            await removeFromWaitingList(pid);
          } catch (e) {
            console.warn('[waiting-list] remove error:', e);
          }
          return;
        }

        // Sentar jugador — emite evento para abrir SeatModal con datos pre-llenados
        if (target.closest('[data-action="sit"]')) {
          const li   = target.closest('.wl-item-new');
          const pid  = li?.dataset.id;
          const name = li?.dataset.name;
          if (!pid || !name) return;

          // Emitir evento al puente React
          window.dispatchEvent(new CustomEvent('open-seat-modal', {
            detail: {
              seatId: null, // el dealer elige el asiento en el modal
              seatInfo: {},
              playerFromWaiting: { id: pid, name },
            }
          }));
          return;
        }
      };
    });
  }, (err) => {
    console.warn('[waiting-list:tableUnsub]', err);
  });

  const combinedUnsubscribe = () => {
    tableUnsub();
    if (wlUnsub) wlUnsub();
  };

  section._unsub = combinedUnsubscribe;
  return combinedUnsubscribe;
}

// ── Render temporal / no usado en el nuevo flujo ────────────────
export function renderWaitingList() {
  return { destroy() {} };
}
export default renderWaitingList;

