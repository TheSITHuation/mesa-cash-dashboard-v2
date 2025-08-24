// src/components/table-settings-modal/table-form.js
import { createTable } from '../../services/firebase/tableService.js';

export function renderCreateTableForm() {
  const app = document.getElementById('app') || document.body;

  // elimina si ya existe
  const old = document.querySelector('.table-form-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.className = 'table-form-overlay';
  overlay.innerHTML = `
    <div class="table-form">
      <div class="table-form__header">
        <h2>Nueva mesa</h2>
        <button class="tf-close" type="button" aria-label="Cerrar">✕</button>
      </div>

      <form class="table-form__body">
        <div class="tf-row">
          <label>Nombre de la mesa</label>
          <input type="text" name="name" placeholder="NLHE VIP, Mesa 3,..." required />
        </div>

        <div class="tf-row">
          <label>Tipo de juego</label>
          <select name="gameType" required>
            <option value="NLHE" selected>NLHE</option>
            <option value="PLO">PLO</option>
            <option value="Mata Ases">Mata Ases</option>
            <option value="DCH">DCH</option>
          </select>
        </div>

        <div class="tf-grid">
          <div class="tf-row">
            <label>Small Blind</label>
            <input type="number" name="smallBlind" min="0" step="1" value="25" required />
          </div>
          <div class="tf-row">
            <label>Big Blind</label>
            <input type="number" name="bigBlind" min="0" step="1" value="50" required />
          </div>
        </div>

        <div class="tf-grid">
          <div class="tf-row">
            <label>Buy-in mínimo</label>
            <input type="number" name="minBuyIn" min="0" step="1" value="200" />
          </div>
          <div class="tf-row">
            <label>Buy-in máximo</label>
            <input type="number" name="maxBuyIn" min="0" step="1" value="5000" />
          </div>
        </div>

        <div class="tf-actions">
          <button type="submit" class="tf-btn tf-btn--primary">Crear mesa</button>
          <button type="button" class="tf-btn tf-btn--ghost tf-cancel">Cancelar</button>
        </div>
      </form>
    </div>
  `;

  app.appendChild(overlay);

  // Cerrar
  overlay.querySelector('.tf-close').addEventListener('click', () => overlay.remove());
  overlay.querySelector('.tf-cancel').addEventListener('click', () => overlay.remove());

  // Submit
  overlay.querySelector('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: (fd.get('name') || '').toString().trim(),
      gameType: (fd.get('gameType') || 'NLHE').toString(),
      smallBlind: Number(fd.get('smallBlind') || 0),
      bigBlind: Number(fd.get('bigBlind') || 0),
      minBuyIn: Number(fd.get('minBuyIn') || 0),
      maxBuyIn: Number(fd.get('maxBuyIn') || 0),
      status: 'inactive',
      active: false,
    };

    try {
      const tableId = await createTable(payload);
      overlay.remove();
      // redirige directamente a la nueva mesa
      window.location.href = `/?table=${tableId}`;
    } catch (err) {
      console.error('[table-form] No se pudo crear:', err);
      alert('No se pudo crear la mesa. Revisa la consola.');
    }
  });
}
