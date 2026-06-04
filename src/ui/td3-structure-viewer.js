// src/ui/td3-structure-viewer.js
const API_BASE = 'https://td3getstructure-it7r4vyplq-uc.a.run.app';

export async function showStructureViewer(container, tournamentId = 'currentTournament') {
  if (!container) return;
  
  container.innerHTML = `
    <div class="structure-viewer">
      <div class="structure-header">
        <h4>📋 Estructura del Torneo</h4>
        <span class="structure-loading">Cargando...</span>
      </div>
      <div class="structure-content"></div>
    </div>
    
    <style>
      .structure-viewer {
        background: rgba(255,255,255,0.03);
        border-radius: 16px;
        padding: 16px;
        margin-top: 12px;
      }
      .structure-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .structure-header h4 {
        margin: 0;
        font-size: 14px;
        color: rgba(255,255,255,0.8);
      }
      .structure-loading {
        font-size: 12px;
        color: rgba(255,255,255,0.4);
      }
      .structure-content {
        max-height: 400px;
        overflow-y: auto;
      }
      .structure-row {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        border-radius: 8px;
        margin-bottom: 4px;
        font-size: 13px;
        transition: background 0.2s;
      }
      .structure-row:hover {
        background: rgba(255,255,255,0.05);
      }
      .structure-row.break {
        background: rgba(255, 159, 10, 0.1);
        border-left: 3px solid #ff9f0a;
      }
      .structure-row.round {
        background: rgba(255,255,255,0.02);
        border-left: 3px solid rgba(255,255,255,0.1);
      }
      .structure-row.active {
        background: rgba(48, 209, 88, 0.15);
        border-left-color: #30d158;
      }
      .structure-position {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(255,255,255,0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 600;
        margin-right: 12px;
        flex-shrink: 0;
      }
      .structure-row.break .structure-position {
        background: rgba(255, 159, 10, 0.3);
      }
      .structure-row.active .structure-position {
        background: rgba(48, 209, 88, 0.3);
      }
      .structure-label {
        flex: 1;
        color: rgba(255,255,255,0.7);
      }
      .structure-row.break .structure-label {
        color: #ff9f0a;
        font-weight: 600;
      }
      .structure-duration {
        color: rgba(255,255,255,0.4);
        font-size: 12px;
        margin-right: 12px;
      }
      .structure-blinds {
        color: rgba(255,255,255,0.5);
        font-size: 12px;
        font-family: monospace;
      }
      .structure-empty {
        text-align: center;
        padding: 32px;
        color: rgba(255,255,255,0.4);
        font-size: 13px;
      }
    </style>
  `;

  try {
    const response = await fetch(`${API_BASE}?tournament=${encodeURIComponent(tournamentId)}`);
    const data = await response.json();

    const content = container.querySelector('.structure-content');
    const loading = container.querySelector('.structure-loading');
    
    if (loading) loading.style.display = 'none';

    if (!data.ok || !data.rounds || data.rounds.length === 0) {
      content.innerHTML = '<div class="structure-empty">No hay estructura cargada.<br>Sube el CSV desde TD3.</div>';
      return;
    }

    content.innerHTML = data.rounds.map(r => `
      <div class="structure-row ${r.isBreak ? 'break' : 'round'}" data-position="${r.position}">
        <div class="structure-position">${r.position}</div>
        <div class="structure-label">${r.label}</div>
        <div class="structure-duration">${r.durationMin} min</div>
        ${!r.isBreak ? `<div class="structure-blinds">${r.smallBlind}/${r.bigBlind}</div>` : ''}
      </div>
    `).join('');

  } catch (err) {
    console.error('[StructureViewer] Error:', err);
    const content = container.querySelector('.structure-content');
    const loading = container.querySelector('.structure-loading');
    if (loading) loading.style.display = 'none';
    if (content) content.innerHTML = '<div class="structure-empty">Error al cargar la estructura</div>';
  }
}

export function highlightCurrentRound(container, currentRound) {
  if (!container) return;
  
  const rows = container.querySelectorAll('.structure-row');
  rows.forEach(row => {
    row.classList.remove('active');
    const pos = parseInt(row.dataset.position, 10);
    if (pos === currentRound) {
      row.classList.add('active');
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}
