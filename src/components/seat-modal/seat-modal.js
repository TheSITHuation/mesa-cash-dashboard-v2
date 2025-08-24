// src/components/seat-modal/seat-modal.js
import { getTableId } from '../../utils/getTableId.js';
import { playerAvatars } from '../../data/playerAvatars.js';
import { removePlayerFromWaitingList } from '../../services/firebase/waitingListService.js';
import { sitPlayer } from '../../services/firebase/seatService.js';

// Elementos del DOM
let modalEl, formEl, inputName, inputBuyin, selectSeat, btnClose;
let searchInput, previewGrid;

// Estado local del picker
let selectedAvatarPath = '';
let selectedAvatarBtn  = null;

// ===== Helpers UI =====
function showModal()  { modalEl?.classList.remove('hidden'); }
export function closeModal() { modalEl?.classList.add('hidden'); }

function markSelected(btn) {
  if (selectedAvatarBtn) selectedAvatarBtn.classList.remove('selected');
  selectedAvatarBtn = btn;
  if (btn) btn.classList.add('selected');
}

function renderAvatarGrid(list) {
  if (!previewGrid) return;
  previewGrid.innerHTML = '';
  list.forEach(({ name, path }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'avatar-item';
    btn.title = name;
    btn.dataset.path = path;
    btn.innerHTML = `<img src="${path}" alt="${name}">`;
    btn.addEventListener('click', () => {
      selectedAvatarPath = path;
      if (searchInput) {
        searchInput.value = name;
        searchInput.dataset.avatarPath = path;
      }
      markSelected(btn);
    });
    previewGrid.appendChild(btn);
  });
}

function filterAvatars(q) {
  const query = (q || '').trim().toLowerCase();
  if (!query) return playerAvatars;
  return playerAvatars.filter(a => a.name.toLowerCase().includes(query));
}

// ===== Submit principal: sentar jugador =====
async function onSubmitSitPlayer(e) {
  e.preventDefault();

  const tableId = getTableId();
  const rawSeat = selectSeat?.value || '';
  const seatId  = /^seat_\d+$/.test(rawSeat) ? rawSeat : `seat_${String(rawSeat).replace(/\D/g,'')}`;
  const name    = (inputName?.value || '').trim();
  const chips   = Number(inputBuyin?.value || 0);

  const avatarFromData   = searchInput?.dataset?.avatarPath || '';
  const avatarFromClick  = selectedAvatarPath || '';
  const avatarFromSearch = (() => {
    const q = (searchInput?.value || '').trim().toLowerCase();
    if (!q) return '';
    const hit = playerAvatars.find(a => a.name.toLowerCase() === q || a.name.toLowerCase().includes(q));
    return hit ? hit.path : '';
  })();
  const avatarPath = avatarFromData || avatarFromClick || avatarFromSearch || '/avatars/default.png';

  if (!tableId)                   return alert('No se detectó mesa activa.');
  if (!/^seat_\d+$/.test(seatId)) return alert('Asiento inválido.');
  if (!name || chips <= 0)        return alert('Completa nombre y un buy-in válido.');

  // Escribe usando el servicio (inicializa playTime y seatNumber)
  await sitPlayer(tableId, seatId, {
    name,
    chips,
    avatarUrl: avatarPath,
    buyIns: 1,
    movements: [{ type: 'buyin', amount: chips, ts: Date.now() }],
  });

  // Si este jugador venía de la waiting list, elimínalo
  const playerIdFromWL = (searchInput?.dataset?.playerId || '').trim();
  if (playerIdFromWL) {
    try { await removePlayerFromWaitingList(playerIdFromWL, tableId); }
    catch (err) { console.warn('[waiting-list] no se pudo eliminar tras sentar:', err); }
  }

  // Limpieza UI
  formEl?.reset();
  if (searchInput) {
    searchInput.dataset.avatarPath = '';
    searchInput.dataset.playerId = '';
  }
  selectedAvatarPath = '';
  markSelected(null);
  closeModal();
}

// ===== API pública =====
export function initModal() {
  modalEl     = document.getElementById('seat-modal');
  formEl      = document.getElementById('form-seat-available');
  inputName   = document.getElementById('player-name');
  inputBuyin  = document.getElementById('buy-in');
  selectSeat  = document.getElementById('seat-select');
  btnClose    = document.getElementById('seat-modal-close');

  searchInput = document.getElementById('avatar-search-input');
  previewGrid = document.getElementById('avatar-preview');

  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (formEl)   formEl.addEventListener('submit', onSubmitSitPlayer);

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const list = filterAvatars(e.target.value);
      renderAvatarGrid(list);
      // autoselección si coincide exacto
      const exact = playerAvatars.find(a => a.name.toLowerCase() === (e.target.value || '').trim().toLowerCase());
      if (exact) {
        selectedAvatarPath = exact.path;
        searchInput.dataset.avatarPath = exact.path;
        const btn = [...(previewGrid?.querySelectorAll('.avatar-item') || [])]
          .find(b => b.dataset.path === exact.path);
        markSelected(btn || null);
      } else {
        searchInput.dataset.avatarPath = '';
        markSelected(null);
      }
    });
  }

  renderAvatarGrid(playerAvatars);
}

export function openModal(seatId, seatInfo = {}, playerFromWaiting) {
  if (selectSeat && seatId) selectSeat.value = seatId;
  if (inputName && playerFromWaiting?.name) inputName.value = playerFromWaiting.name;
  if (inputBuyin) inputBuyin.value = '';

  if (searchInput) {
    searchInput.dataset.playerId = playerFromWaiting?.id || '';
  }

  selectedAvatarPath = '';
  if (searchInput) {
    searchInput.value = '';
    searchInput.dataset.avatarPath = '';
  }
  markSelected(null);
  showModal();
}
