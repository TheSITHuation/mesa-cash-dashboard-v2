// src/components/waiting-list/waiting-list.js
import { openModal as openSeatModal } from '../seat-modal/seat-modal.js';
import {
  addToWaitingList,
  removePlayerFromWaitingList,
  listenToWaitingList
} from '../../services/firebase/waitingListService.js';

// Lucide (vanilla JS)
import { createIcons, Armchair, Eraser } from 'lucide';

export function initWaitingList(tableIdOverride) {
  const waitingListEl       = document.getElementById('waiting-list');
  const addToWaitlistBtn    = document.getElementById('add-to-waitlist-btn');
  const addPlayerForm       = document.getElementById('add-player-form');
  const newPlayerNameInput  = document.getElementById('player-name-input');
  const confirmAddPlayerBtn = document.getElementById('confirm-add-player-btn');

  if (addToWaitlistBtn) {
    addToWaitlistBtn.addEventListener('click', () => {
      addPlayerForm?.classList.remove('hidden');
      addToWaitlistBtn?.classList.add('hidden');
      newPlayerNameInput?.focus();
    });
  }

  if (confirmAddPlayerBtn) {
    confirmAddPlayerBtn.addEventListener('click', async () => {
      const playerName = (newPlayerNameInput?.value || '').trim();
      if (!playerName) return;
      await addToWaitingList(playerName, tableIdOverride);
      if (newPlayerNameInput) newPlayerNameInput.value = '';
      addPlayerForm?.classList.add('hidden');
      addToWaitlistBtn?.classList.remove('hidden');
    });
  }

  // Delegación de eventos (sentar / eliminar)
  if (waitingListEl) {
    waitingListEl.addEventListener('click', async (e) => {
      const sitBtn    = e.target.closest?.('.sit-btn');
      const deleteBtn = e.target.closest?.('.delete-btn');
      if (!sitBtn && !deleteBtn) return;

      const li = e.target.closest('li');
      if (!li) return;

      let player = {};
      try {
        player = JSON.parse(li.dataset.player || '{}');
      } catch {
        player = {};
      }
      if (!player || !player.name) return;

      if (sitBtn) {
        // Enviamos los datos al modal: al ocupar el asiento, el modal
        // se encargará de eliminar de la waiting list cuando corresponda.
        openSeatModal(
          null,
          { status: 'available' },
          {
            id: player.id || null,
            name: player.name,
            avatarUrl: player.avatar || '',
            chips: Number(player.chips || 0),
          }
        );
      } else if (deleteBtn) {
        if (confirm(`¿Eliminar a ${player.name} de la lista?`)) {
          await removePlayerFromWaitingList(player.id, tableIdOverride);
        }
      }
    });
  }

  // Suscripción en tiempo real
  const unsubscribe = listenToWaitingList((players) => {
    renderWaitingList(players);
  }, tableIdOverride);

  return unsubscribe;
}

export function renderWaitingList(players) {
  const waitingListEl = document.getElementById('waiting-list');
  if (!waitingListEl) return;

  waitingListEl.innerHTML = '';

  if (!players || players.length === 0) {
    waitingListEl.innerHTML = `<li class="empty-list">La lista de espera está vacía.</li>`;
    // Aún así invocamos createIcons por consistencia (no hay íconos, pero no pasa nada)
    createIcons({ icons: { Armchair, Eraser } });
    return;
  }

  for (const player of players) {
    if (!player || !player.name) continue;

    const li = document.createElement('li');
    li.className = 'waiting-list-item';
    li.dataset.player = JSON.stringify(player);

    const hasAvatar = !!player.avatar && typeof player.avatar === 'string' && player.avatar.trim() !== '';
    const avatarHTML = hasAvatar
      ? `<img class="wl-avatar" src="${player.avatar}" alt="${player.name}" />`
      : `<div class="wl-avatar placeholder">${player.name.charAt(0).toUpperCase()}</div>`;

    li.innerHTML = `
      <div class="waiting-player">
        ${avatarHTML}
        <span class="wl-name">${player.name}</span>
        <div class="player-actions">
          <button class="wl-action-btn sit-btn" title="Sentar">
            <i data-lucide="armchair"></i>
          </button>
          <button class="wl-action-btn delete-btn" title="Eliminar">
            <i data-lucide="eraser"></i>
          </button>
        </div>
      </div>
    `;

    waitingListEl.appendChild(li);
  }

  // IMPORTANTÍSIMO: reemplaza los <i data-lucide="..."> por SVGs
  createIcons({
    icons: { Armchair, Eraser },
    attrs: { width: 18, height: 18, stroke: 'currentColor', 'stroke-width': 2 }
  });
}
