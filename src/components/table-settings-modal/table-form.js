// src/components/table-settings-modal/table-form.js
import { createTable, updateTable } from '../../services/firebase/tableService.js';
import { getTableSlots } from '../../services/firebase/tableSlotsService.js';

/**
 * Abre el formulario "Premium" para crear/editar una mesa.
 */
export function openTableForm({
  mode = 'create',
  initial = {},
  title,
  onSubmit,
} = {}) {
  // Cierra si ya hay uno abierto
  document.querySelectorAll('.tf-overlay').forEach(el => el.remove());

  const isEdit = mode === 'edit';
  const T = title || (isEdit ? 'Editar Mesa' : 'Nueva Mesa');

  // Valores por defecto
  const v = {
    name: initial.name ?? '',
    gameType: initial.gameType ?? 'NLHE',
    smallBlind: initial.smallBlind ?? '',
    bigBlind: initial.bigBlind ?? '',
    minBuyIn: initial.minBuyIn ?? '',
    maxBuyIn: initial.maxBuyIn ?? '',
    maxSeats: initial.maxSeats ?? '',
    publicLobby: initial.publicLobby ?? true,
    status: initial.status ?? 'inactive',
    maxAbsenceMinutes: initial.maxAbsenceMinutes ?? 15,
  };

  // Crear overlay básico primero (sin wheel picker aún)
  const overlay = document.createElement('div');
  overlay.className = 'tf-overlay';
  overlay.innerHTML = `
    <div class="tf-card" role="dialog" aria-modal="true">
      <div class="tf-head">
        <h3 class="tf-title">${T}</h3>
        <button type="button" class="tf-close" aria-label="Cerrar"></button>
      </div>
      <form id="tf-form">
        <div class="tf-field full" style="margin-bottom:16px">
          <label class="tf-label" for="tf-name">Nombre de la mesa</label>
          <input id="tf-name" name="name" class="tf-input" type="text" value="${String(v.name)}" placeholder="Ej: NLHE VIP 1/2">
        </div>
        <div class="tf-grid">
          <div class="tf-field">
            <label class="tf-label" for="tf-gameType">Modalidad</label>
            <select id="tf-gameType" name="gameType" class="tf-input">
              <option value="NLHE" ${v.gameType === 'NLHE' ? 'selected' : ''}>NLHE</option>
              <option value="PLO"  ${v.gameType === 'PLO' ? 'selected' : ''}>PLO</option>
              <option value="MAA"  ${v.gameType === 'MAA' ? 'selected' : ''}>MAA</option>
              <option value="DCH"  ${v.gameType === 'DCH' ? 'selected' : ''}>DCH</option>
              <option value="V&V"  ${v.gameType === 'V&V' ? 'selected' : ''}>V&V</option>
            </select>
          </div>
          <div class="tf-field">
            <label class="tf-label" for="tf-maxSeats">Asientos</label>
            <select id="tf-maxSeats" name="maxSeats" class="tf-input">
              <option value="6" ${Number(v.maxSeats) === 6 ? 'selected' : ''}>6 Jugadores</option>
              <option value="8" ${Number(v.maxSeats) === 8 ? 'selected' : ''}>8 Jugadores</option>
              <option value="9" ${Number(v.maxSeats) === 9 ? 'selected' : ''}>9 Jugadores</option>
            </select>
          </div>
          <div class="tf-field">
            <label class="tf-label">Ciega Pequeña (SB)</label>
            <input name="smallBlind" class="tf-input" type="number" min="0" value="${v.smallBlind}" placeholder="Ej: 25">
          </div>
          <div class="tf-field">
            <label class="tf-label">Ciega Grande (BB)</label>
            <input name="bigBlind" class="tf-input" type="number" min="0" value="${v.bigBlind}" placeholder="Ej: 50">
          </div>
          <div class="tf-field">
            <label class="tf-label">Buy-in Mínimo</label>
            <input name="minBuyIn" class="tf-input" type="number" min="0" step="50" value="${v.minBuyIn}" placeholder="Ej: 1000">
          </div>
          <div class="tf-field">
            <label class="tf-label">Buy-in Máximo</label>
            <input name="maxBuyIn" class="tf-input" type="number" min="0" step="50" value="${v.maxBuyIn}" placeholder="Ej: 5000">
          </div>
          <div class="tf-field full">
             <label class="tf-label">Ajustes</label>
             <label class="tf-switch">
               <input id="tf-publicLobby" name="publicLobby" type="checkbox" ${v.publicLobby ? 'checked' : ''}>
               <span>Mesa visible en el Lobby público</span>
             </label>
          </div>
          <div class="tf-field">
            <label class="tf-label" for="tf-maxAbsence">Máximo Ausencia</label>
            <select id="tf-maxAbsence" name="maxAbsenceMinutes" class="tf-input">
              <option value="10" ${Number(v.maxAbsenceMinutes) === 10 ? 'selected' : ''}>10 min</option>
              <option value="15" ${Number(v.maxAbsenceMinutes) === 15 ? 'selected' : ''}>15 min</option>
              <option value="20" ${Number(v.maxAbsenceMinutes) === 20 ? 'selected' : ''}>20 min</option>
              <option value="30" ${Number(v.maxAbsenceMinutes) === 30 ? 'selected' : ''}>30 min</option>
            </select>
          </div>
          <div class="tf-field">
            <label class="tf-label" for="tf-status">Estado Inicial</label>
            <select id="tf-status" name="status" class="tf-input">
              <option value="inactive" ${v.status === 'inactive' ? 'selected' : ''}>Stop</option>
              ${isEdit ? '<option value="active">Activa</option>' : ''}
              <option value="en-espera"${v.status === 'en-espera' ? 'selected' : ''}>En espera</option>
            </select>
          </div>
        </div>
        <div class="tf-actions">
          <button type="button" class="btn tf-cancel">Cancelar</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Guardar Cambios' : 'Crear Mesa'}</button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('.tf-close').addEventListener('click', close);
  overlay.querySelector('.tf-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  // Si es creación, agregar wheel picker dinámicamente
  if (!isEdit) {
    getTableSlots().then(slots => {
      const availableSlots = slots.availableSlots;
      if (availableSlots.length > 0) {
        const selectedSlotId = availableSlots[0];
        const wheelItems = availableSlots.map((s, i) => `
          <div class="tf-wheel-item ${i === 0 ? 'selected' : ''}" data-slot="${s}" data-index="${i}" style="height:34px;flex-shrink:0;display:flex;align-items:center;justify-content:center;scroll-snap-align:center;cursor:pointer;user-select:none">
            <span class="tf-wheel-item__label" style="font-size:16px;font-weight:600;color:${i === 0 ? '#30d158' : 'rgba(255,255,255,0.3)'};transition:all 0.15s ease;${i === 0 ? 'font-weight:700;transform:scale(1.1)' : ''}">${s.replace('Table-', '')}</span>
          </div>
        `).join('');

        const wheelHTML = `
          <div style="display:grid;grid-template-columns:1fr auto;gap:12px;margin-bottom:16px;align-items:start">
            <div class="tf-field">
              <label class="tf-label" for="tf-name">Nombre de la mesa</label>
              <input id="tf-name" name="name" class="tf-input" type="text" value="${String(v.name)}" placeholder="Ej: NLHE VIP 1/2">
            </div>
            <div class="tf-field" style="min-width:100px">
              <label class="tf-label tf-label--clickable" id="tf-mesa-toggle" style="cursor:pointer;display:flex;align-items:center;gap:6px;user-select:none">
                Mesa
                <span class="tf-mesa-arrow" style="display:inline-block;transition:transform 0.2s ease;font-size:10px;color:rgba(255,255,255,0.4)">▼</span>
              </label>
              <div class="tf-wheel-picker-wrapper" id="tf-wheel-wrapper" style="max-height:0;overflow:hidden;transition:max-height 0.3s ease,opacity 0.2s ease;opacity:0">
                <div class="tf-wheel-picker" id="tf-slot-wheel" style="position:relative;height:100px;overflow:hidden;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);margin-top:8px">
                  <div style="position:absolute;top:0;left:0;right:0;height:34px;background:linear-gradient(to bottom,rgba(12,16,22,0.95),transparent);pointer-events:none;z-index:2"></div>
                  <div style="position:absolute;top:50%;left:0;right:0;height:34px;transform:translateY(-50%);background:rgba(48,209,88,0.08);border-top:1px solid rgba(48,209,88,0.3);border-bottom:1px solid rgba(48,209,88,0.3);pointer-events:none;z-index:1"></div>
                  <div style="position:absolute;bottom:0;left:0;right:0;height:34px;background:linear-gradient(to top,rgba(12,16,22,0.95),transparent);pointer-events:none;z-index:2"></div>
                  <div class="tf-wheel-picker__track" id="tf-wheel-track" style="height:100%;overflow-y:auto;overflow-x:hidden;scroll-snap-type:y mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:0;display:flex;flex-direction:column">
                    <div style="height:34px;flex-shrink:0"></div>
                    ${wheelItems}
                    <div style="height:34px;flex-shrink:0"></div>
                  </div>
                </div>
              </div>
              <input type="hidden" name="slotId" id="tf-slot-hidden" value="${selectedSlotId}">
            </div>
          </div>
        `;

        // Reemplazar el campo nombre con el grid
        const nameField = overlay.querySelector('.tf-field.full');
        if (nameField) {
          nameField.outerHTML = wheelHTML;

          // Toggle del wheel picker
          const toggleBtn = overlay.querySelector('#tf-mesa-toggle');
          const wrapper = overlay.querySelector('#tf-wheel-wrapper');
          const arrow = overlay.querySelector('.tf-mesa-arrow');
          let wheelOpen = false;

          toggleBtn.addEventListener('click', () => {
            wheelOpen = !wheelOpen;
            if (wheelOpen) {
              wrapper.style.maxHeight = '120px';
              wrapper.style.opacity = '1';
              arrow.style.transform = 'rotate(180deg)';
            } else {
              wrapper.style.maxHeight = '0';
              wrapper.style.opacity = '0';
              arrow.style.transform = 'rotate(0deg)';
            }
          });

          // Agregar event listeners del wheel
          const wheelTrack = overlay.querySelector('#tf-wheel-track');
          const hiddenInput = overlay.querySelector('#tf-slot-hidden');
          if (wheelTrack && hiddenInput) {
            const items = wheelTrack.querySelectorAll('.tf-wheel-item');
            const ITEM_HEIGHT = 34;

            function updateSelection(index) {
              items.forEach((item, i) => {
                const label = item.querySelector('.tf-wheel-item__label');
                if (i === index) {
                  item.classList.add('selected');
                  label.style.color = '#30d158';
                  label.style.fontWeight = '700';
                  label.style.transform = 'scale(1.1)';
                } else {
                  item.classList.remove('selected');
                  label.style.color = 'rgba(255,255,255,0.3)';
                  label.style.fontWeight = '600';
                  label.style.transform = 'scale(1)';
                }
              });
              if (items[index]) {
                hiddenInput.value = items[index].dataset.slot;
              }
            }

            wheelTrack.addEventListener('scroll', () => {
              const scrollTop = wheelTrack.scrollTop;
              const centerIndex = Math.round(scrollTop / ITEM_HEIGHT);
              const clampedIndex = Math.max(0, Math.min(items.length - 1, centerIndex));
              updateSelection(clampedIndex);
            }, { passive: true });

            items.forEach(item => {
              item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index, 10);
                wheelTrack.scrollTo({ top: index * ITEM_HEIGHT, behavior: 'smooth' });
              });
            });
          }
        }
      }
    }).catch(e => {
      console.warn('[table-form] No se pudo cargar slots:', e);
    });
  }

  overlay.querySelector('#tf-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const payload = {
      name: (fd.get('name') || '').toString().trim(),
      gameType: (fd.get('gameType') || 'NLHE').toString(),
      smallBlind: Number(fd.get('smallBlind') || 0),
      bigBlind: Number(fd.get('bigBlind') || 0),
      minBuyIn: Number(fd.get('minBuyIn') || 0),
      maxBuyIn: Number(fd.get('maxBuyIn') || 0),
      maxSeats: Number(fd.get('maxSeats') || 9),
      publicLobby: !!fd.get('publicLobby'),
      status: (fd.get('status') || 'inactive').toString(),
      maxAbsenceMinutes: Number(fd.get('maxAbsenceMinutes') || 15),
      active: false,
    };

    if (!payload.name) { alert('Pon un nombre a la mesa'); return; }

    const selectedSlotId = !isEdit ? (fd.get('slotId') || null) : null;

    try {
      if (onSubmit) {
        await onSubmit(payload, selectedSlotId);
      } else if (isEdit && initial?.id) {
        await updateTable(initial.id, payload);
      } else {
        const newId = await createTable(payload, selectedSlotId);
        if (newId) location.href = `?table=${newId}`;
      }
      close();
    } catch (err) {
      console.error('[table-form] submit error', err);
      alert(err.message || 'No se pudo guardar la mesa.');
    }
  });
}

export function renderCreateTableForm() {
  openTableForm({
    mode: 'create',
    title: 'Nueva Mesa',
    onSubmit: async (payload, slotId) => {
      const newId = await createTable(payload, slotId);
      if (newId) location.href = `?table=${newId}`;
    }
  });
}
