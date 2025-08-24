// src/components/table-banner/table-banner.js
import './table-banner.scss';

/**
 * Crea (si no existe) y devuelve el contenedor del banner.
 */
function ensureBanner() {
  let root = document.getElementById('info-banner');
  if (root) return root;

  root = document.createElement('div');
  root.id = 'info-banner';
  root.className = 'info-banner';
  root.innerHTML = `
    <div class="banner-item">
      <span class="label">Juego</span>
      <span class="value" id="banner-game">-</span>
    </div>
    <div class="banner-item">
      <span class="label">Ciegas</span>
      <span class="value" id="banner-blinds">-</span>
    </div>
    <div class="banner-item">
      <span class="label">Buy-in</span>
      <span class="value" id="banner-buyin">-</span>
    </div>
  `;
  document.body.appendChild(root);
  return root;
}

function fmt(n) {
  const num = Number(n ?? 0);
  return num.toLocaleString('es-MX', { maximumFractionDigits: 0 });
}

/**
 * Renderiza/actualiza el banner inferior con los datos de la mesa.
 * @param {Object} mesaData - { gameType, smallBlind, bigBlind, minBuyIn, maxBuyIn }
 */
export function renderTableBanner(mesaData = {}) {
  const el = ensureBanner();

  const game   = mesaData.gameType ?? '-';
  const sb     = mesaData.smallBlind ?? '-';
  const bb     = mesaData.bigBlind ?? '-';
  const minB   = mesaData.minBuyIn ?? '-';
  const maxB   = mesaData.maxBuyIn ?? '-';

  el.querySelector('#banner-game').textContent   = String(game);
  el.querySelector('#banner-blinds').textContent = (sb === '-' || bb === '-')
    ? '-'
    : `${fmt(sb)} / ${fmt(bb)}`;
  el.querySelector('#banner-buyin').textContent  = (minB === '-' || maxB === '-')
    ? '-'
    : `$${fmt(minB)} / $${fmt(maxB)}`;
}

/**
 * (Opcional) Quita el banner del DOM.
 */
export function destroyTableBanner() {
  const el = document.getElementById('info-banner');
  if (el) el.remove();
}
