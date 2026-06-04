// src/components/dealer-modal/dealer-modal.js
import { db } from '../../services/config/firebaseConfig.js';
import { doc, updateDoc } from 'firebase/firestore';
import { getTableId } from '../../utils/getTableId.js';

// ✅ Ajusta esta lista a los avatares que tengas en /dealers/
const DEALER_AVATARS = [
  '/dealers/dealer_man.png',
  '/dealers/dealer_woman.png',
  '/dealers/dealer3.png',
  '/dealers/dealer4.png',
  '/dealers/dealer5.png',
  '/dealers/dealer6.png'
];

function getElements() {
  return {
    modalEl: document.getElementById('dealer-modal'),
    closeBtn: document.getElementById('close-dealer-modal'),
    galleryEl: document.getElementById('dealer-gallery')
  };
}

// Renderiza miniaturas
function renderGallery(selectedSrc = null) {
  const { galleryEl } = getElements();
  if (!galleryEl) return;

  // Si ya hay contenido y no hay cambio de selección, no tocar para evitar parpadeo
  if (galleryEl.children.length > 0 && !selectedSrc) return;

  galleryEl.innerHTML = DEALER_AVATARS.map(src => `
    <button class="dealer-thumb${src === selectedSrc ? ' is-selected' : ''}" data-src="${src}" type="button" aria-label="Elegir croupier">
      <img src="${src}" alt="Croupier" />
    </button>
  `).join('');
}

// Aplica el avatar en la UI (sin esperar re-render)
function applyDealerInDOM(src) {
  const dealerSeatImg = document.querySelector('.dealer-seat .dealer-card__front img');
  if (dealerSeatImg) dealerSeatImg.src = src;
}

// Guarda en Firestore y actualiza UI
async function pickDealer(src) {
  try {
    const tableId = getTableId();
    if (!tableId) return;

    const ref = doc(db, 'tables', tableId);
    await updateDoc(ref, { dealerAvatar: src });

    applyDealerInDOM(src);

    const { galleryEl } = getElements();
    galleryEl?.querySelectorAll('.dealer-thumb').forEach(btn => {
      btn.classList.toggle('is-selected', btn.dataset.src === src);
    });

    // Cierra el modal
    setTimeout(closeDealerModal, 200);
  } catch (err) {
    console.error('[dealer-modal] Error al guardar dealerAvatar:', err);
  }
}

export function closeDealerModal() {
  const { modalEl } = getElements();
  modalEl?.classList.add('hidden');
}

function ensureDealerModal() {
  if (document.getElementById('dealer-modal')) return;

  const modal = document.createElement('div');
  modal.id = 'dealer-modal';
  modal.className = 'modal-overlay hidden';
  modal.innerHTML = `
    <div class="modal-content">
      <button id="close-dealer-modal" class="close-button">✕</button>
      <h2 id="modal-title">Seleccionar Croupier</h2>
      <div id="dealer-gallery" class="gallery"></div>
    </div>
  `;
  document.body.appendChild(modal);
}

export function openDealerModal() {
  ensureDealerModal();
  const { modalEl } = getElements();
  if (!modalEl) return;
  renderGallery();
  modalEl.classList.remove('hidden');
}

export function initDealerModal() {
  ensureDealerModal();

  const { modalEl, closeBtn, galleryEl } = getElements();
  if (!modalEl) return;

  // Cerrar
  if (closeBtn) {
    closeBtn.onclick = () => closeDealerModal();
  }
  if (modalEl) {
    modalEl.onclick = (e) => {
      if (e.target === modalEl) closeDealerModal();
    };
  }

  // Delegación de clicks en galería
  if (galleryEl) {
    galleryEl.onclick = (e) => {
      const btn = e.target.closest('.dealer-thumb');
      if (!btn || btn.classList.contains('is-selected')) return;
      const src = btn.dataset.src;
      if (src) pickDealer(src);
    };
  }

  renderGallery();
}
