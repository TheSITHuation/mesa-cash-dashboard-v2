// src/components/dealer-modal/dealer-modal.js
import { db } from '../../services/config/firebaseConfig.js';
import { doc, updateDoc } from 'firebase/firestore';
import { getTableId } from '../../utils/getTableId.js';

// === DOM ===
const modalEl   = document.getElementById('dealer-modal');
const closeBtn  = document.getElementById('close-dealer-modal');
const galleryEl = document.getElementById('dealer-gallery');

// ✅ Ajusta esta lista a los avatares que tengas en /public/avatars
const DEALER_AVATARS = [
  '/dealers/dealer_man.png',
  '/dealers/dealer_woman.png',
  '/dealers/dealer3.png',
  '/dealers/dealer4.png',
  '/dealers/dealer5.png',
  '/dealers/dealer6.png'
];

// Renderiza miniaturas
function renderGallery(selectedSrc = null) {
  if (!galleryEl) return;
  galleryEl.innerHTML = DEALER_AVATARS.map(src => `
    <button class="dealer-thumb${src === selectedSrc ? ' is-selected' : ''}" data-src="${src}" type="button" aria-label="Elegir croupier">
      <img src="${src}" alt="Croupier" />
    </button>
  `).join('');
}

// Aplica el avatar en la UI (sin esperar re-render)
function applyDealerInDOM(src) {
  const dealerSeat = document.querySelector('.dealer-seat img');
  if (dealerSeat) dealerSeat.src = src;
}

// Guarda en Firestore y actualiza UI
async function pickDealer(src) {
  try {
    const tableId = getTableId();
    const ref = doc(db, 'tables', tableId);
    await updateDoc(ref, { dealerAvatar: src });

    // Actualiza inmediatamente la imagen en la mesa
    applyDealerInDOM(src);

    // Marca seleccionado en la galería (feedback visual)
    galleryEl?.querySelectorAll('.dealer-thumb').forEach(btn => {
      btn.classList.toggle('is-selected', btn.dataset.src === src);
    });

    // Cierra el modal
    closeDealerModal();
  } catch (err) {
    console.error('[dealer-modal] Error al guardar dealerAvatar:', err);
    alert('No se pudo guardar el croupier. Revisa la consola para más detalles.');
  }
}

function closeDealerModal() {
  modalEl?.classList.add('hidden');
}

export function openDealerModal() {
  if (!modalEl) return;
  // Renderiza galería (siempre por si cambian assets)
  renderGallery();
  modalEl.classList.remove('hidden');
}

export function initDealerModal() {
  if (!modalEl) return;

  // Cerrar
  closeBtn?.addEventListener('click', closeDealerModal);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeDealerModal(); // click fuera del contenido
  });

  // Delegación de clicks en galería
  galleryEl?.addEventListener('click', (e) => {
    const btn = e.target.closest('.dealer-thumb');
    if (!btn) return;
    const src = btn.dataset.src;
    if (src) pickDealer(src);
  });

  // Render inicial por si el modal ya está visible
  renderGallery();
}

// Auto-init (opcional). O llama initDealerModal() desde tu main.js
initDealerModal();
