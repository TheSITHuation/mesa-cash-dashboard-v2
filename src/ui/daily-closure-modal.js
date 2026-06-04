// src/ui/daily-closure-modal.js
import {
  listenTableClosures,
  listenDailyClosures,
  confirmDailyClosure,
  exportDailyClosureToSheets,
} from '../services/firebase/closureService.js';
import {
  getGoogleSheetsConfig,
  getOperatingDate,
  saveGoogleSheetsConfig
} from '../services/firebase/googleSheetsService.js';

function fmt(n, d = 2) {
  return Number(n || 0).toFixed(d);
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function todayKey() {
  return getOperatingDate(new Date(), 6);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Abre el modal de configuración de Google Sheets
 * @param {Function} onSaved - Callback ejecutado tras guardar con éxito
 */
export function openSheetsConfigModal(onSaved) {
  const existing = document.querySelector('.sheets-config-overlay');
  if (existing) existing.remove();

  const configOverlay = document.createElement('div');
  configOverlay.className = 'sheets-config-overlay';
  configOverlay.style.cssText = `
    position: fixed; inset: 0; z-index: 11000;
    background: rgba(0,0,0,0.85); backdrop-filter: blur(16px);
    display: flex; align-items: center; justify-content: center;
    padding: 20px; opacity: 0; transition: opacity .25s ease;
  `;

  configOverlay.innerHTML = `
    <div class="sheets-config-card" style="
      background: #111116; border: 1px solid rgba(212,175,55,0.2);
      border-radius: 20px; width: min(520px, 100%);
      box-shadow: 0 30px 60px rgba(0,0,0,0.8); padding: 24px;
      position: relative; color: #fff; font-family: inherit;
    ">
      <button id="sc-close-btn" style="
        position: absolute; top: 16px; right: 16px;
        width: 28px; height: 28px; border-radius: 99px;
        border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05);
        color: rgba(255,255,255,0.6); cursor: pointer; display: flex;
        align-items: center; justify-content: center; font-size: 16px;
      ">&times;</button>
      
      <h3 style="margin: 0 0 16px 0; font-size: 18px; color: #d4af37; font-weight: 700; display: flex; align-items: center; gap: 8px;">
        <span>⚙️</span> Configuración de Google Sheets
      </h3>
      
      <div style="font-size: 12px; line-height: 1.5; color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 10px; margin-bottom: 20px;">
        <strong>Instrucciones rápidas:</strong><br>
        1. Crea un proyecto en <a href="https://script.google.com/" target="_blank" style="color: #d4af37; text-decoration: underline;">Google Apps Script</a>.<br>
        2. Copia y pega el código base de <code style="background: rgba(255,255,255,0.1); padding: 1px 4px; border-radius: 3px;">docs/google-sheets-setup.md</code>.<br>
        3. Haz clic en <strong>Implementar</strong> &gt; <strong>Nueva implementación</strong> (Tipo: Aplicación Web, Ejecutar como: Yo, Acceso: Cualquiera).<br>
        4. Copia la URL generada y pégala aquí abajo.
      </div>

      <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 24px;">
        <label style="display: flex; flex-direction: column; gap: 6px;">
          <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.5);">URL Web App de Google Sheets</span>
          <input type="url" id="sc-url" placeholder="https://script.google.com/macros/s/.../exec" style="
            background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
            border-radius: 10px; padding: 12px; color: #fff; font-size: 13px; font-family: inherit;
            outline: none; transition: border-color 0.2s; width: 100%; box-sizing: border-box;
          " />
        </label>
        
        <label style="display: flex; flex-direction: column; gap: 6px;">
          <span style="font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.5);">Hora de corte operativa</span>
          <div style="display: flex; align-items: center; gap: 10px;">
            <select id="sc-cutoff" style="
              background: #111116; border: 1px solid rgba(255,255,255,0.1);
              border-radius: 10px; padding: 10px; color: #fff; font-size: 13px; font-family: inherit;
              outline: none; cursor: pointer; flex: 1;
            ">
              ${Array.from({ length: 24 }).map((_, i) => `
                <option value="${i}">${String(i).padStart(2, '0')}:00 ${i < 12 ? 'AM' : 'PM'}</option>
              `).join('')}
            </select>
            <span style="font-size: 11px; color: rgba(255,255,255,0.4); max-width: 180px;">Cierres antes de esta hora se asignan al día anterior.</span>
          </div>
        </label>
      </div>

      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button id="sc-cancel-btn" style="
          padding: 10px 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);
          background: transparent; color: rgba(255,255,255,0.6); cursor: pointer; font-size: 12px; font-weight: 600;
        ">Cancelar</button>
        <button id="sc-save-btn" style="
          padding: 10px 20px; border-radius: 10px; border: none;
          background: #d4af37; color: #050508; cursor: pointer; font-size: 12px; font-weight: 700;
          box-shadow: 0 4px 12px rgba(212,175,55,0.2);
        ">Guardar Cambios</button>
      </div>
    </div>
  `;

  document.body.appendChild(configOverlay);
  requestAnimationFrame(() => configOverlay.style.opacity = '1');

  // Cargar configuración actual
  getGoogleSheetsConfig().then((cfg) => {
    configOverlay.querySelector('#sc-url').value = cfg.googleSheetsUrl || '';
    configOverlay.querySelector('#sc-cutoff').value = cfg.cutoffHour;
  });

  const closeConfig = () => {
    configOverlay.style.opacity = '0';
    setTimeout(() => configOverlay.remove(), 250);
  };

  configOverlay.querySelector('#sc-close-btn').addEventListener('click', closeConfig);
  configOverlay.querySelector('#sc-cancel-btn').addEventListener('click', closeConfig);
  configOverlay.addEventListener('click', (e) => { if (e.target === configOverlay) closeConfig(); });

  configOverlay.querySelector('#sc-save-btn').addEventListener('click', async () => {
    const url = configOverlay.querySelector('#sc-url').value.trim();
    const cutoff = parseInt(configOverlay.querySelector('#sc-cutoff').value, 10);
    const saveBtn = configOverlay.querySelector('#sc-save-btn');
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';
    try {
      await saveGoogleSheetsConfig(url, cutoff);
      closeConfig();
      onSaved?.();
    } catch (err) {
      console.error('[sc-config] Error saving:', err);
      alert('Error al guardar la configuración: ' + err.message);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar Cambios';
    }
  });
}

export function openDailyClosureModal(onClose) {
  const existing = document.querySelector('.daily-closure-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'daily-closure-overlay';
  overlay.style.cssText = `position:fixed;inset:0;z-index:10000;background:rgba(4,6,10,.85);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .25s ease;`;
  overlay.innerHTML = `
    <style>
      .daily-closure-card{background:linear-gradient(165deg,rgba(25,28,35,.97),rgba(10,12,16,.99));border:1px solid rgba(255,255,255,.1);border-radius:28px;width:min(640px,100%);max-height:calc(100vh - 40px);display:flex;flex-direction:column;overflow:hidden;box-shadow:0 40px 120px rgba(0,0,0,.8),inset 0 1px 1px rgba(255,255,255,.05);}
      .daily-closure-header{display:flex;align-items:center;justify-content:space-between;padding:24px 28px 16px;border-bottom:1px solid rgba(255,255,255,.05);flex-wrap:wrap;gap:10px;}
      .daily-closure-header h2{margin:0;font-size:20px;font-weight:700;letter-spacing:-.5px;background:linear-gradient(135deg,#fff,#a1a1aa);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
      .daily-closure-date-nav{display:flex;align-items:center;gap:6px;}
      .daily-closure-date-btn,.daily-closure-today-btn{height:30px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:rgba(255,255,255,.6);cursor:pointer;font-size:13px;font-weight:600;transition:.2s;display:flex;align-items:center;justify-content:center;}
      .daily-closure-date-btn{width:30px;}
      .daily-closure-today-btn{padding:0 12px;font-size:11px;}
      .daily-closure-date-btn:hover,.daily-closure-today-btn:hover{background:rgba(255,255,255,.1);color:#fff;}
      .daily-closure-date-display{font-size:13px;font-weight:600;color:#fff;min-width:80px;text-align:center;}
      .daily-closure-close{width:32px;height:32px;border-radius:10px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.6);cursor:pointer;font-size:18px;transition:.2s;display:flex;align-items:center;justify-content:center;}
      .daily-closure-close:hover{background:rgba(255,255,255,.1);color:#fff;}
      .daily-closure-body{padding:24px 28px;overflow-y:auto;flex:1;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent;}
      .daily-closure-body::-webkit-scrollbar{width:4px;}
      .daily-closure-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.1);border-radius:10px;}
      .dc-loading{padding:40px 0;text-align:center;color:rgba(255,255,255,.5);font-size:14px;}
      .dc-summary{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:16px;margin-bottom:20px;}
      .dc-summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:16px;}
      .dc-summary-item{display:flex;flex-direction:column;gap:4px;}
      .dc-summary-label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:rgba(255,255,255,.3);}
      .dc-summary-value{font-size:20px;font-weight:700;color:#fff;font-variant-numeric:tabular-nums;}
      .dc-value-gold{color:#d4af37;}
      .dc-value-green{color:#30d158;}
      .dc-tables-section{margin-bottom:20px;}
      .dc-section-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#d4af37;margin-bottom:12px;}
      .dc-tables-list{display:flex;flex-direction:column;gap:6px;}
      .dc-table-row{display:flex;align-items:center;gap:12px;padding:10px 14px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;}
      .dc-table-info{flex:1;display:flex;flex-direction:column;gap:2px;}
      .dc-table-name{font-size:13px;font-weight:600;color:#fff;}
      .dc-table-meta{font-size:11px;color:rgba(255,255,255,.35);}
      .dc-table-stats{text-align:right;min-width:60px;}
      .dc-table-stat{font-size:13px;font-weight:700;color:#30d158;font-variant-numeric:tabular-nums;}
      .dc-table-stat-label{font-size:9px;text-transform:uppercase;letter-spacing:.5px;color:rgba(255,255,255,.3);display:block;}
      .dc-empty{text-align:center;padding:30px 20px;color:rgba(255,255,255,.3);margin-bottom:20px;background:rgba(255,255,255,.02);border-radius:16px;border:1px solid rgba(255,255,255,.05);}
      .dc-empty-icon{font-size:32px;margin-bottom:8px;opacity:.4;}
      .dc-confirm-section{display:flex;flex-direction:column;gap:12px;margin-bottom:20px;}
      .dc-notes-field{display:flex;flex-direction:column;gap:6px;}
      .dc-notes-field span{font-size:11px;font-weight:600;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.5px;}
      .dc-notes-field textarea,.dc-notes-field input{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 14px;color:#fff;font-size:14px;outline:none;transition:.2s;font-family:inherit;}
      .dc-notes-field textarea:focus,.dc-notes-field input:focus{border-color:rgba(212,175,55,.4);background:rgba(212,175,55,.03);}
      .dc-notes-field input::placeholder,.dc-notes-field textarea::placeholder{color:rgba(255,255,255,.2);}
      .dc-actions{display:flex;gap:12px;flex-wrap:wrap;}
      .dc-btn{flex:1;height:48px;border-radius:14px;font-size:13px;font-weight:700;cursor:pointer;border:1px solid rgba(255,255,255,.1);transition:.2s;display:flex;align-items:center;justify-content:center;gap:6px;font-family:inherit;}
      .dc-btn:hover{filter:brightness(1.1);transform:translateY(-1px);}
      .dc-btn:disabled{opacity:.4;cursor:not-allowed;transform:none;filter:none;}
      .dc-btn-export{background:rgba(255,255,255,.05);color:rgba(255,255,255,.7);}
      .dc-btn-export:hover{background:rgba(255,255,255,.1);color:#fff;}
      .dc-btn-confirm{background:linear-gradient(135deg,#d4af37,#b8860b);color:#000;border:none;box-shadow:0 8px 20px rgba(184,134,11,.25);}
      .dc-btn-confirm:hover{filter:brightness(1.1);}
      .dc-btn-confirm:disabled{opacity:.6;filter:none;}
      @keyframes spin{to{transform:rotate(360deg)}}
    </style>
    <div class="daily-closure-card">
      <div class="daily-closure-header">
        <h2>Cierre del Día</h2>
        <div class="daily-closure-date-nav">
          <button class="daily-closure-date-btn" id="dc-prev-day">&lt;</button>
          <span class="daily-closure-date-display" id="dc-date-display"></span>
          <button class="daily-closure-date-btn" id="dc-next-day">&gt;</button>
          <button class="daily-closure-today-btn" id="dc-today-btn">Hoy</button>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button class="daily-closure-close" id="dc-config-btn" title="Configurar Google Sheets" style="font-size: 14px;">⚙️</button>
          <button class="daily-closure-close" id="dc-close-btn">&times;</button>
        </div>
      </div>
      <div class="daily-closure-body" id="dc-body">
        <div class="dc-loading">Cargando...</div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.style.opacity = '1');

  const close = () => {
    overlay.style.opacity = '0';
    if (unsubTable) unsubTable();
    if (unsubDaily) unsubDaily();
    setTimeout(() => { overlay.remove(); onClose?.(); }, 250);
  };

  overlay.querySelector('#dc-close-btn').addEventListener('click', close);
  overlay.querySelector('#dc-config-btn').addEventListener('click', () => {
    openSheetsConfigModal(() => loadData());
  });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  let currentDate = todayKey();
  let unsubTable = null;
  let unsubDaily = null;
  let currentClosures = [];
  let currentDaily = null;

  // Date navigation
  overlay.querySelector('#dc-prev-day').addEventListener('click', () => {
    const d = new Date(currentDate + 'T12:00:00');
    d.setDate(d.getDate() - 1);
    currentDate = d.toISOString().slice(0, 10);
    loadData();
  });

  overlay.querySelector('#dc-next-day').addEventListener('click', () => {
    const d = new Date(currentDate + 'T12:00:00');
    d.setDate(d.getDate() + 1);
    if (d.toISOString().slice(0, 10) > todayKey()) return;
    currentDate = d.toISOString().slice(0, 10);
    loadData();
  });

  overlay.querySelector('#dc-today-btn').addEventListener('click', () => {
    currentDate = todayKey();
    loadData();
  });

  function loadData() {
    if (unsubTable) unsubTable();
    if (unsubDaily) unsubDaily();

    overlay.querySelector('#dc-date-display').textContent = formatDate(currentDate);
    const body = overlay.querySelector('#dc-body');
    body.innerHTML = '<div class="dc-loading">Cargando...</div>';

    unsubTable = listenTableClosures(currentDate, (closures) => {
      currentClosures = closures;
      renderContent();
    });

    unsubDaily = listenDailyClosures((allDaily) => {
      currentDaily = allDaily.find(d => d.date === currentDate) || null;
      renderContent();
    });
  }

  function renderContent() {
    const body = overlay.querySelector('#dc-body');

    const totalRakeNeto = currentClosures.reduce((s, c) => s + (c.rakeNeto || 0), 0);
    const totalTips = currentClosures.reduce((s, c) => s + (c.tips || 0), 0);
    const totalRake = currentClosures.reduce((s, c) => s + (c.totalRake || 0), 0);
    const totalJackpot = currentClosures.reduce((s, c) => s + (c.jackpot || 0), 0);
    const totalPromos = currentClosures.reduce((s, c) => s + (c.promotions || 0), 0);
    const totalRP = currentClosures.reduce((s, c) => s + (c.rpCommission || 0), 0);
    const totalAB = currentClosures.reduce((s, c) => s + (c.abAmount || 0), 0);
    const totalFichas = currentClosures.reduce((s, c) => s + (c.totalFichas || 0), 0);
    const avgRPH = currentClosures.length > 0
      ? currentClosures.reduce((s, c) => s + (c.rakePerHour || 0), 0) / currentClosures.length
      : 0;
    const avgOcc = currentClosures.length > 0
      ? currentClosures.reduce((s, c) => s + (c.occupancyPct || 0), 0) / currentClosures.length
      : 0;

    const isConfirmed = currentDaily?.confirmed;
    const hasSheetsUrl = currentDaily?.googleSheetsUrl;

    body.innerHTML = `
      <div class="dc-summary">
        <div class="dc-summary-grid">
          <div class="dc-summary-item">
            <span class="dc-summary-label">Mesas cerradas</span>
            <span class="dc-summary-value dc-value-gold">${currentClosures.length}</span>
          </div>
          <div class="dc-summary-item">
            <span class="dc-summary-label">Rake Total</span>
            <span class="dc-summary-value">${fmt(totalRake, 0)}</span>
          </div>
          <div class="dc-summary-item">
            <span class="dc-summary-label">Rake Neto</span>
            <span class="dc-summary-value dc-value-green">${fmt(totalRakeNeto, 0)}</span>
          </div>
          <div class="dc-summary-item">
            <span class="dc-summary-label">Propinas</span>
            <span class="dc-summary-value">${fmt(totalTips, 0)}</span>
          </div>
          <div class="dc-summary-item">
            <span class="dc-summary-label">Jackpot</span>
            <span class="dc-summary-value">${fmt(totalJackpot, 0)}</span>
          </div>
          <div class="dc-summary-item">
            <span class="dc-summary-label">Promociones</span>
            <span class="dc-summary-value">${fmt(totalPromos, 0)}</span>
          </div>
          <div class="dc-summary-item">
            <span class="dc-summary-label">RP Comisión</span>
            <span class="dc-summary-value">${fmt(totalRP, 0)}</span>
          </div>
          <div class="dc-summary-item">
            <span class="dc-summary-label">A&B</span>
            <span class="dc-summary-value">${fmt(totalAB, 0)}</span>
          </div>
          <div class="dc-summary-item">
            <span class="dc-summary-label">Total Fichas (Flujo)</span>
            <span class="dc-summary-value dc-value-gold">${fmt(totalFichas, 0)}</span>
          </div>
          <div class="dc-summary-item">
            <span class="dc-summary-label">RPH Promedio</span>
            <span class="dc-summary-value">${fmt(avgRPH, 0)}</span>
          </div>
          <div class="dc-summary-item">
            <span class="dc-summary-label">Ocupación Prom.</span>
            <span class="dc-summary-value">${Math.round(avgOcc)}%</span>
          </div>
        </div>
      </div>

      ${currentClosures.length > 0 ? `
        <div class="dc-tables-section">
          <div class="dc-section-title">Mesas cerradas</div>
          <div class="dc-tables-list">
            ${currentClosures.map(c => `
              <div class="dc-table-row">
                <div class="dc-table-info">
                  <span class="dc-table-name">${escapeHtml(c.tableName)}</span>
                  <span class="dc-table-meta">${c.gameType} ${c.blinds?.sb || 0}/${c.blinds?.bb || 0}</span>
                </div>
                <div class="dc-table-stats">
                  <span class="dc-table-stat">${fmt(c.rakeNeto, 0)}</span>
                  <span class="dc-table-stat-label">rake neto</span>
                </div>
                <div class="dc-table-stats">
                  <span class="dc-table-stat">${fmt(c.rakePerHour, 0)}</span>
                  <span class="dc-table-stat-label">RPH</span>
                </div>
                <div class="dc-table-stats">
                  <span class="dc-table-stat">${c.sessionDurationMinutes || 0} min</span>
                  <span class="dc-table-stat-label">duración</span>
                </div>
                <div class="dc-table-stats">
                  <span class="dc-table-stat">${c.occupancyPct || 0}%</span>
                  <span class="dc-table-stat-label">ocupación</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : `
        <div class="dc-empty">
          <div class="dc-empty-icon">&#9824;</div>
          <p>No hay mesas cerradas el ${formatDate(currentDate)}</p>
        </div>
      `}

      <div class="dc-confirm-section">
        <label class="dc-notes-field">
          <span>Notas del cierre</span>
          <textarea id="dc-notes" rows="2" maxlength="300" placeholder="Observaciones generales...">${escapeHtml(currentDaily?.notes || '')}</textarea>
        </label>
        <label class="dc-notes-field">
          <span>Responsable</span>
          <input type="text" id="dc-closed-by" maxlength="50" value="${escapeHtml(currentDaily?.closedBy || '')}" placeholder="Nombre del responsable">
        </label>
      </div>

      <div class="dc-actions">
        ${hasSheetsUrl ? `
          <button class="dc-btn" id="dc-open-sheets" style="background: rgba(48,209,88,.15); border: 1px solid rgba(48,209,88,.4); color: #30d158; display: flex; align-items: center; justify-content: center; gap: 6px;">
            <span>📈</span> Ver Google Sheet
          </button>
          <button class="dc-btn dc-btn-export" id="dc-export-sheets" style="background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); color: #fff;">
            Re-exportar
          </button>
        ` : `
          <button class="dc-btn dc-btn-export" id="dc-export-sheets" ${currentClosures.length === 0 ? 'disabled' : ''}>
            Exportar a Google Sheets
          </button>
        `}
        <button class="dc-btn dc-btn-confirm" id="dc-confirm" ${isConfirmed ? 'disabled' : ''}>
          ${isConfirmed ? '&#10003; Cierre Confirmado' : 'Confirmar Cierre Diario'}
        </button>
      </div>
    `;

    // Abrir Google Sheets
    const openSheetsBtn = body.querySelector('#dc-open-sheets');
    if (openSheetsBtn) {
      openSheetsBtn.addEventListener('click', () => {
        if (currentDaily?.googleSheetsUrl) {
          window.open(currentDaily.googleSheetsUrl, '_blank');
        }
      });
    }

    // Exportar / Re-exportar a Google Sheets
    const exportSheetsBtn = body.querySelector('#dc-export-sheets');
    if (exportSheetsBtn) {
      exportSheetsBtn.addEventListener('click', async () => {
        const config = await getGoogleSheetsConfig();
        if (!config.googleSheetsUrl) {
          alert('Por favor, configura la URL del Web App de Google Sheets primero.');
          openSheetsConfigModal(() => loadData());
          return;
        }

        exportSheetsBtn.disabled = true;
        const originalText = exportSheetsBtn.textContent;
        exportSheetsBtn.innerHTML = `
          <span style="display:inline-block; animation: spin 1s linear infinite; margin-right: 6px;">⏳</span> Exportando...
        `;

        try {
          // Si no se ha confirmado el cierre diario, lo confirmamos automáticamente para asegurar que los datos estén guardados
          if (!currentDaily) {
            const notes = body.querySelector('#dc-notes').value.trim();
            const closedBy = body.querySelector('#dc-closed-by').value.trim();
            await confirmDailyClosure(currentDate, notes, closedBy || 'Sistema');
          }
          
          const result = await exportDailyClosureToSheets(currentDate);
          
          // Abrir en pestaña nueva
          window.open(result.url, '_blank');
          
          // Recargar datos para mostrar "Ver Google Sheet"
          loadData();
        } catch (err) {
          console.error('[daily-closure] Error exporting to Sheets:', err);
          alert('Error al exportar a Google Sheets: ' + err.message);
          exportSheetsBtn.disabled = false;
          exportSheetsBtn.textContent = originalText;
        }
      });
    }

    // Confirm daily closure
    const confirmBtn = body.querySelector('#dc-confirm');
    if (confirmBtn && !isConfirmed) {
      confirmBtn.addEventListener('click', async () => {
        const notes = body.querySelector('#dc-notes').value.trim();
        const closedBy = body.querySelector('#dc-closed-by').value.trim();
        try {
          await confirmDailyClosure(currentDate, notes, closedBy || 'Sistema');
          confirmBtn.disabled = true;
          confirmBtn.innerHTML = '&#10003; Cierre Confirmado';
        } catch (err) {
          console.error('[daily-closure] Error confirming:', err);
          alert('Error al confirmar el cierre diario');
        }
      });
    }
  }

  loadData();
}
