// src/ui/closure-modal.js
import { closeTable, exportIndividualClosureToSheets } from '../services/firebase/closureService.js';
import { db } from '../services/config/firebaseConfig.js';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { getGoogleSheetsConfig } from '../services/firebase/googleSheetsService.js';
import { openSheetsConfigModal } from './daily-closure-modal.js';

function fmt(n, d = 2) {
  return Number(n || 0).toFixed(d);
}

function fmtTime(ms) {
  if (!ms || ms <= 0) return '00:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSec % 3600) / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function computeSessionDurationMs(tableData) {
  const state = tableData?.sessionState || 'idle';
  const startAt = tableData?.sessionStartAt;
  const pausedTotalMs = Number(tableData?.pausedTotalMs || 0);
  const pauseStartAt = tableData?.pauseStartedAt;

  let startMs = null;
  if (startAt) {
    if (typeof startAt.toMillis === 'function') startMs = startAt.toMillis();
    else if (typeof startAt === 'number') startMs = startAt;
    else if (startAt.seconds) startMs = startAt.seconds * 1000 + (startAt.nanoseconds || 0) / 1e6;
  }
  if (!startMs) return 0;

  let pauseStartMs = null;
  if (pauseStartAt) {
    if (typeof pauseStartAt.toMillis === 'function') pauseStartMs = pauseStartAt.toMillis();
    else if (typeof pauseStartAt === 'number') pauseStartMs = pauseStartAt;
    else if (pauseStartAt.seconds) pauseStartMs = pauseStartAt.seconds * 1000 + (pauseStartAt.nanoseconds || 0) / 1e6;
  }

  let raw;
  if (state === 'running') raw = Date.now() - startMs - pausedTotalMs;
  else if (state === 'paused') raw = (pauseStartMs || Date.now()) - startMs - pausedTotalMs;
  else return 0;
  return Math.max(0, raw);
}

export function openClosureModal(tableId, onClose) {
  const existing = document.querySelector('.closure-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'closure-overlay';
  overlay.style.cssText = `position:fixed;inset:0;z-index:10000;background:rgba(4,6,10,.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .25s ease;`;
  overlay.innerHTML = `
    <style>
      .closure-card{background:linear-gradient(165deg,rgba(25,28,35,.97),rgba(10,12,16,.99));border:1px solid rgba(255,255,255,.1);border-radius:28px;width:min(560px,100%);max-height:calc(100vh - 40px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 40px 120px rgba(0,0,0,.8),inset 0 1px 1px rgba(255,255,255,.05);}
      .closure-header{display:flex;align-items:center;justify-content:space-between;padding:24px 28px 16px;border-bottom:1px solid rgba(255,255,255,.05);}
      .closure-header h2{margin:0;font-size:20px;font-weight:700;letter-spacing:-.5px;background:linear-gradient(135deg,#fff,#a1a1aa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
      .closure-close{width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;transition:.2s;}
      .closure-close:hover{background:rgba(255,255,255,.1);color:#fff;}
      .closure-body{padding:24px 28px;overflow-y:auto;flex:1;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent;}
      .closure-body::-webkit-scrollbar{width:4px;}
      .closure-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:10px;}
      .closure-loading,.closure-error{padding:40px 0;text-align:center;color:rgba(255,255,255,.5);font-size:14px;}
      .closure-error{color:#ff6b6b;}
      .closure-summary{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:16px;display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;}
      .closure-summary-row{display:flex;flex-direction:column;gap:2px;}
      .closure-summary-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,.3);}
      .closure-summary-value{font-size:15px;font-weight:600;color:#fff;}
      .closure-section-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#d4af37;margin-bottom:12px;}
      .closure-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;}
      .closure-field{display:flex;flex-direction:column;gap:6px;}
      .closure-field span{font-size:11px;font-weight:600;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.5px;}
      .closure-field input,.closure-field textarea{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 14px;color:#fff;font-size:14px;outline:none;transition:.2s;font-family:inherit;}
      .closure-field input:focus,.closure-field textarea:focus{border-color:rgba(212,175,55,.4);background:rgba(212,175,55,.03);}
      .closure-field input::placeholder,.closure-field textarea::placeholder{color:rgba(255,255,255,.2);}
      .deductions-menu{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;}
      .deduction-link{display:flex;align-items:center;gap:8px;padding:10px 16px;border-radius:12px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:rgba(255,255,255,.5);cursor:pointer;transition:.2s;font-size:13px;font-weight:600;}
      .deduction-link:hover{background:rgba(255,255,255,.07);color:rgba(255,255,255,.8);}
      .deduction-link.active{background:rgba(212,175,55,.12);border-color:rgba(212,175,55,.35);color:#d4af37;}
      .deduction-icon{display:flex;opacity:.5;}
      .deduction-link.active .deduction-icon{opacity:1;}
      .deduction-panel{overflow:hidden;}
      .deduction-content{max-height:0;overflow:hidden;transition:max-height .3s ease,opacity .2s ease;opacity:0;margin-bottom:0;}
      .deduction-content.visible{max-height:100px;opacity:1;margin-bottom:16px;}
      .deduction-content input,.deduction-rp-fields input{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 14px;color:#fff;font-size:14px;outline:none;transition:.2s;font-family:inherit;width:100%;box-sizing:border-box;}
      .deduction-content input:focus,.deduction-rp-fields input:focus{border-color:rgba(212,175,55,.4);background:rgba(212,175,55,.03);}
      .deduction-content input::placeholder,.deduction-rp-fields input::placeholder{color:rgba(255,255,255,.2);}
      .deduction-rp-fields{display:flex;gap:8px;}
      .closure-preview{background:rgba(48,209,88,.05);border:1px solid rgba(48,209,88,.15);border-radius:16px;padding:16px;margin-bottom:20px;}
      .closure-preview-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#30d158;margin-bottom:12px;}
      .closure-preview-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:12px;}
      .closure-preview-item{display:flex;flex-direction:column;gap:4px;}
      .closure-preview-label{font-size:10px;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:.5px;}
      .closure-preview-value{font-size:18px;font-weight:700;color:#30d158;font-variant-numeric:tabular-nums;}
      .closure-players{margin-bottom:20px;}
      .closure-player-row{display:flex;align-items:center;gap:12px;padding:8px 12px;background:rgba(255,255,255,.03);border-radius:10px;margin-bottom:4px;}
      .closure-player-seat{font-size:11px;font-weight:700;color:#d4af37;min-width:24px;}
      .closure-player-name{flex:1;font-size:13px;font-weight:500;color:rgba(255,255,255,.7);}
      .closure-player-chips{font-size:13px;font-weight:600;color:#fff;font-variant-numeric:tabular-nums;}
      .closure-no-players{padding:12px;text-align:center;color:rgba(255,255,255,.3);font-size:12px;}
      .closure-notes{margin-bottom:20px;}
      .closure-actions{display:flex;gap:12px;}
      .closure-btn{flex:1;height:48px;border-radius:14px;font-size:14px;font-weight:700;cursor:pointer;border:none;transition:.2s;display:flex;align-items:center;justify-content:center;}
      .closure-btn-cancel{background:rgba(255,255,255,.05);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.08);}
      .closure-btn-cancel:hover{background:rgba(255,255,255,.1);color:#fff;}
      .closure-btn-confirm{background:linear-gradient(135deg,#d4af37,#b8860b);color:#000;box-shadow:0 8px 20px rgba(184,134,11,.25);}
      .closure-btn-confirm:hover{filter:brightness(1.1);transform:translateY(-1px);}
      .closure-btn-confirm:disabled{opacity:.5;cursor:not-allowed;transform:none;filter:none;}
      .closure-btn-export{background:rgba(48,209,88,.12);border:1px solid rgba(48,209,88,.3);color:#30d158;}
      .closure-btn-export:hover{background:rgba(48,209,88,.2);}
      .closure-btn-done{background:rgba(255,255,255,.05);color:rgba(255,255,255,.6);border:1px solid rgba(255,255,255,.08);}
      .closure-btn-done:hover{background:rgba(255,255,255,.1);color:#fff;}
    </style>
    <div class="closure-card">
      <div class="closure-header">
        <h2>Cierre de Mesa</h2>
        <button class="closure-close" id="closure-close-btn">&times;</button>
      </div>
      <div class="closure-body" id="closure-body">
        <div class="closure-loading">Cargando datos de la mesa...</div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.style.opacity = '1');

  const close = () => {
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.remove(); onClose?.(); }, 300);
  };

  overlay.querySelector('#closure-close-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  loadTableData(tableId, overlay, close);
}

async function loadTableData(tableId, overlay, close) {
  const body = overlay.querySelector('#closure-body');

  try {
    const tableRef = doc(db, 'tables', tableId);
    const tableSnap = await getDoc(tableRef);
    if (!tableSnap.exists()) {
      body.innerHTML = '<div class="closure-error">Mesa no encontrada</div>';
      return;
    }

    const table = tableSnap.data();
    const seatsRef = collection(db, 'tables', tableId, 'seats');
    const seatsSnap = await getDocs(seatsRef);
    const players = [];
    let occupiedCount = 0;

    seatsSnap.forEach(snap => {
      const seat = snap.data();
      const isOccupied = seat?.status === 'occupied' || seat?.name || seat?.playerName;
      if (isOccupied) occupiedCount++;
      players.push({
        seatNumber: seat?.seatNumber || 0,
        name: seat?.name || seat?.playerName || '',
        chips: Number(seat?.chips || 0),
      });
    });

    const durationMs = computeSessionDurationMs(table);
    const durationMin = Math.round(durationMs / 60000);

    body.innerHTML = `
      <div class="closure-summary">
        <div class="closure-summary-row">
          <span class="closure-summary-label">Mesa</span>
          <span class="closure-summary-value">${escapeHtml(table.name || tableId)}</span>
        </div>
        <div class="closure-summary-row">
          <span class="closure-summary-label">Juego</span>
          <span class="closure-summary-value">${table.gameType || 'NLHE'} ${table.smallBlind || 0}/${table.bigBlind || 0}</span>
        </div>
        <div class="closure-summary-row">
          <span class="closure-summary-label">Duración sesión</span>
          <span class="closure-summary-value">${fmtTime(durationMs)} (${durationMin} min)</span>
        </div>
        <div class="closure-summary-row">
          <span class="closure-summary-label">Jugadores</span>
          <span class="closure-summary-value">${occupiedCount} / ${table.maxSeats || 9}</span>
        </div>
      </div>

      <div class="closure-section-title">Datos Financieros</div>

      <div class="closure-form-grid">
        <label class="closure-field">
          <span>Total Rake</span>
          <input type="number" id="cl-rake" min="0" step="1" value="0" placeholder="0">
        </label>
        <label class="closure-field">
          <span>Propinas</span>
          <input type="number" id="cl-tips" min="0" step="1" value="0" placeholder="0">
        </label>
      </div>

      <div class="closure-section-title">Descuentos</div>

      <div class="deductions-menu" id="deductions-menu">
        <div class="deduction-link" data-deduction="jackpot" id="deduction-jackpot-link">
          <span class="deduction-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </span>
          <span class="deduction-title">Jackpot</span>
        </div>
        <div class="deduction-link" data-deduction="promos" id="deduction-promos-link">
          <span class="deduction-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/></svg>
          </span>
          <span class="deduction-title">Promociones</span>
        </div>
        <div class="deduction-link" data-deduction="rp" id="deduction-rp-link">
          <span class="deduction-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 8v2"/><path d="M22 14v2"/><path d="M18 11h8"/><path d="M18 17h8"/></svg>
          </span>
          <span class="deduction-title">RP</span>
        </div>
        <div class="deduction-link" data-deduction="ab" id="deduction-ab-link">
          <span class="deduction-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </span>
          <span class="deduction-title">A&B</span>
        </div>
      </div>

      <div class="deduction-panel" id="deduction-panel">
        <div class="deduction-content" id="deduction-jackpot-content">
          <input type="number" id="cl-jackpot" min="0" step="1" value="0" placeholder="Monto del jackpot">
        </div>
        <div class="deduction-content" id="deduction-promos-content">
          <input type="number" id="cl-promo" min="0" step="1" value="0" placeholder="Monto de promociones">
        </div>
        <div class="deduction-content" id="deduction-rp-content">
          <div class="deduction-rp-fields">
            <input type="number" id="cl-rp-pct" min="0" max="100" step="0.5" value="1" placeholder="%">
            <input type="text" id="cl-rp-name" maxlength="40" placeholder="Nombre del RP">
          </div>
        </div>
        <div class="deduction-content" id="deduction-ab-content">
          <input type="number" id="cl-ab" min="0" step="1" value="0" placeholder="Monto A&B">
        </div>
      </div>

      <div class="closure-preview" id="closure-preview">
        <div class="closure-preview-title">Métricas Calculadas</div>
        <div class="closure-preview-grid">
          <div class="closure-preview-item">
            <span class="closure-preview-label">Rake Neto</span>
            <span class="closure-preview-value" id="cl-prev-rake-neto">0</span>
          </div>
          <div class="closure-preview-item">
            <span class="closure-preview-label">Total Fichas</span>
            <span class="closure-preview-value" id="cl-prev-total-fichas">0</span>
          </div>
          <div class="closure-preview-item">
            <span class="closure-preview-label">Rake/Hora</span>
            <span class="closure-preview-value" id="cl-prev-rph">0</span>
          </div>
          <div class="closure-preview-item">
            <span class="closure-preview-label">RPH Ajustado</span>
            <span class="closure-preview-value" id="cl-prev-rph-adj">0</span>
          </div>
          <div class="closure-preview-item">
            <span class="closure-preview-label">Ocupación</span>
            <span class="closure-preview-value" id="cl-prev-occ">0%</span>
          </div>
        </div>
      </div>

      <label class="closure-field closure-notes">
        <span>Notas (opcional)</span>
        <textarea id="cl-notes" rows="2" maxlength="200" placeholder="Observaciones..."></textarea>
      </label>

      <div class="closure-players" id="closure-players">
        <div class="closure-section-title">Jugadores en la mesa</div>
        ${players.filter(p => p.name).map(p => `
          <div class="closure-player-row">
            <span class="closure-player-seat">S${p.seatNumber}</span>
            <span class="closure-player-name">${escapeHtml(p.name)}</span>
            <span class="closure-player-chips">${fmt(p.chips, 0)}</span>
          </div>
        `).join('')}
        ${players.filter(p => p.name).length === 0 ? '<div class="closure-no-players">Sin jugadores registrados</div>' : ''}
      </div>

      <div class="closure-actions">
        <button class="closure-btn closure-btn-cancel" id="cl-cancel">Cancelar</button>
        <button class="closure-btn closure-btn-confirm" id="cl-confirm">Confirmar Cierre</button>
      </div>
    `;

    // Bind deduction menu items (click to toggle, exclusive)
    const deductionLinks = body.querySelectorAll('.deduction-link');
    const contents = body.querySelectorAll('.deduction-content');

    deductionLinks.forEach(link => {
      link.addEventListener('click', () => {
        const key = link.dataset.deduction;
        const isActive = link.classList.contains('active');

        // Deactivate all
        deductionLinks.forEach(l => l.classList.remove('active'));
        contents.forEach(c => c.classList.remove('visible'));

        // If was active, deactivate (toggle off)
        if (isActive) {
          contents.forEach(c => {
            c.querySelectorAll('input').forEach(i => i.value = 0);
          });
        } else {
          // Activate this one
          link.classList.add('active');
          const content = body.querySelector(`#deduction-${key}-content`);
          if (content) content.classList.add('visible');
        }
        updatePreview();
      });
    });

    // Bind all inputs to update preview
    ['cl-rake', 'cl-tips', 'cl-jackpot', 'cl-promo', 'cl-rp-pct', 'cl-ab'].forEach(id => {
      body.querySelector(`#${id}`)?.addEventListener('input', updatePreview);
    });

    const occupancy = table.maxSeats > 0 ? occupiedCount / table.maxSeats : 0;

    function updatePreview() {
      const totalRake = Number(body.querySelector('#cl-rake').value || 0);
      const jackpotActive = body.querySelector('[data-deduction="jackpot"]').classList.contains('active');
      const promosActive = body.querySelector('[data-deduction="promos"]').classList.contains('active');
      const rpActive = body.querySelector('[data-deduction="rp"]').classList.contains('active');
      const abActive = body.querySelector('[data-deduction="ab"]').classList.contains('active');

      const jackpot = jackpotActive ? Number(body.querySelector('#cl-jackpot').value || 0) : 0;
      const promotions = promosActive ? Number(body.querySelector('#cl-promo').value || 0) : 0;
      const rpPct = rpActive ? Number(body.querySelector('#cl-rp-pct').value || 0) : 0;
      const abAmount = abActive ? Number(body.querySelector('#cl-ab').value || 0) : 0;

      const rpCommission = rpActive ? (totalRake * rpPct / 100) : 0;
      const rakeNeto = Math.max(0, totalRake - promotions - rpCommission - abAmount);
      const totalFichas = totalRake + jackpot + Number(body.querySelector('#cl-tips').value || 0);
      const durationHours = durationMs / (1000 * 60 * 60);
      const rph = durationHours > 0 ? rakeNeto / durationHours : 0;
      const rphAdj = occupancy > 0 ? rph / occupancy : rph;

      body.querySelector('#cl-prev-rake-neto').textContent = fmt(rakeNeto, 0);
      body.querySelector('#cl-prev-total-fichas').textContent = fmt(totalFichas, 0);
      body.querySelector('#cl-prev-rph').textContent = fmt(rph, 0);
      body.querySelector('#cl-prev-rph-adj').textContent = fmt(rphAdj, 0);
      body.querySelector('#cl-prev-occ').textContent = `${Math.round(occupancy * 100)}%`;
    }

    updatePreview();

    // Cancel
    body.querySelector('#cl-cancel').addEventListener('click', close);

    // Confirm
    body.querySelector('#cl-confirm').addEventListener('click', async () => {
      const confirmBtn = body.querySelector('#cl-confirm');
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Cerrando...';

      try {
        const totalRake = Number(body.querySelector('#cl-rake').value || 0);
        if (totalRake <= 0) {
          alert('Ingresa el total de rake recaudado.');
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Confirmar Cierre';
          return;
        }

        const jackpotActive = body.querySelector('[data-deduction="jackpot"]').classList.contains('active');
        const promosActive = body.querySelector('[data-deduction="promos"]').classList.contains('active');
        const rpActive = body.querySelector('[data-deduction="rp"]').classList.contains('active');
        const abActive = body.querySelector('[data-deduction="ab"]').classList.contains('active');

        const closureData = {
          totalRake,
          tips: Number(body.querySelector('#cl-tips').value || 0),
          jackpot: jackpotActive ? Number(body.querySelector('#cl-jackpot').value || 0) : 0,
          promotions: promosActive ? Number(body.querySelector('#cl-promo').value || 0) : 0,
          rpEnabled: rpActive,
          rpPct: rpActive ? Number(body.querySelector('#cl-rp-pct').value || 0) : 0,
          rpName: rpActive ? body.querySelector('#cl-rp-name').value.trim() : '',
          abEnabled: abActive,
          abAmount: abActive ? Number(body.querySelector('#cl-ab').value || 0) : 0,
          notes: body.querySelector('#cl-notes').value.trim(),
          durationMs,
          closedBy: 'Sistema',
        };

        const result = await closeTable(tableId, closureData);

        // Mostrar éxito y opción de exportar a Google Sheets
        body.innerHTML = `
          <div class="closure-success" style="text-align: center; padding: 20px 0;">
            <div class="closure-success-icon" style="font-size: 40px; color: #30d158; margin-bottom: 12px;">&#10003;</div>
            <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #fff; font-weight: 700;">Mesa cerrada correctamente</h3>
            <p style="margin: 0 0 24px 0; font-size: 14px; color: rgba(255,255,255,.6);">
              ${escapeHtml(table.name || tableId)} — Rake Neto: ${fmt(result.rakeNeto, 0)}
            </p>
            <div class="closure-success-actions" style="display: flex; flex-direction: column; gap: 10px; max-width: 280px; margin: 0 auto;">
              <button class="closure-btn closure-btn-export" id="cl-export-sheets" style="width: 100%;">
                Exportar a Google Sheets
              </button>
              <button class="closure-btn closure-btn-done" id="cl-done" style="width: 100%;">Cerrar</button>
            </div>
          </div>
        `;

        const exportBtn = body.querySelector('#cl-export-sheets');
        if (exportBtn) {
          exportBtn.addEventListener('click', async () => {
            const config = await getGoogleSheetsConfig();
            if (!config.googleSheetsUrl) {
              alert('Por favor, configura la URL del Web App de Google Sheets primero.');
              openSheetsConfigModal();
              return;
            }

            exportBtn.disabled = true;
            const originalText = exportBtn.textContent;
            exportBtn.innerHTML = `
              <span style="display:inline-block; animation: spin 1s linear infinite; margin-right: 6px;">⏳</span> Exportando...
            `;

            try {
              const sheetResult = await exportIndividualClosureToSheets(result.id);
              window.open(sheetResult.url, '_blank');
              
              // Cambiar aspecto del botón para indicar éxito
              exportBtn.innerHTML = '🟢 Ver en Google Sheets';
              exportBtn.disabled = false;
              exportBtn.style.background = 'rgba(48,209,88,.15)';
              exportBtn.style.borderColor = 'rgba(48,209,88,.4)';
              exportBtn.style.color = '#30d158';
              
              // Re-bind para abrir la URL
              exportBtn.addEventListener('click', () => {
                window.open(sheetResult.url, '_blank');
              });
            } catch (err) {
              console.error('[closure-modal] Error exporting to Sheets:', err);
              alert('Error al exportar a Google Sheets: ' + err.message);
              exportBtn.disabled = false;
              exportBtn.textContent = originalText;
            }
          });
        }

        body.querySelector('#cl-done').addEventListener('click', close);

      } catch (err) {
        console.error('[closure-modal] Error:', err);
        alert('Error al cerrar la mesa: ' + err.message);
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirmar Cierre';
      }
    });

  } catch (err) {
    console.error('[closure-modal] Error loading table:', err);
    body.innerHTML = `<div class="closure-error">Error al cargar datos: ${err.message}</div>`;
  }
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
