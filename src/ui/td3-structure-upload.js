// src/ui/td3-structure-upload.js
import { showToast } from './toast.js';

const MODAL_ID = 'td3-structure-upload-modal';
const API_BASE = 'https://td3structure-it7r4vyplq-uc.a.run.app';
let mounted = false;
let currentTournamentId = 'currentTournament';

export function showStructureUpload(tournamentId = 'currentTournament') {
  currentTournamentId = tournamentId;
  let modal = document.getElementById(MODAL_ID);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'login-backdrop';
    modal.innerHTML = `
      <div class="login-card structure-upload-card">
        <h3>📋 Estructura del Torneo</h3>
        <p class="upload-description">
          Exporta la estructura desde TD3 (Rondas → Exportar → CSV) y súbela aquí para calcular descansos automáticamente.
        </p>
        
        <div class="upload-tournament-id" style="margin-bottom:12px">
          <label style="font-size:12px;color:rgba(255,255,255,.5);display:block;margin-bottom:4px">ID del Torneo</label>
          <input type="text" id="upload-tournament-id" value="${tournamentId}" placeholder="currentTournament" style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#fff;font-size:13px;font-family:inherit;outline:none" />
        </div>
        
        <div class="upload-area" id="upload-area">
          <div class="upload-icon">📄</div>
          <p>Arrastra tu archivo CSV aquí o</p>
          <button type="button" id="browse-btn" class="btn-browse">Seleccionar archivo</button>
          <input type="file" id="csv-file-input" accept=".csv,.txt" style="display:none" />
        </div>
        
        <div id="upload-status" class="upload-status" style="display:none">
          <div class="status-spinner"></div>
          <span>Subiendo estructura...</span>
        </div>
        
        <div id="upload-result" class="upload-result" style="display:none"></div>
        
        <button id="close-structure-upload" type="button" class="btn-text-signup">Cerrar</button>
      </div>

      <style>
        .structure-upload-card {
          width: min(95vw, 480px);
          animation: modalScaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .upload-description {
          color: rgba(255,255,255,0.6);
          font-size: 13px;
          line-height: 1.5;
          margin-bottom: 20px;
        }
        .upload-area {
          border: 2px dashed rgba(255,255,255,0.2);
          border-radius: 16px;
          padding: 32px 20px;
          text-align: center;
          transition: all 0.3s ease;
          cursor: pointer;
          margin-bottom: 16px;
        }
        .upload-area:hover, .upload-area.dragover {
          border-color: #30d158;
          background: rgba(48, 209, 88, 0.05);
        }
        .upload-icon {
          font-size: 48px;
          margin-bottom: 12px;
        }
        .upload-area p {
          color: rgba(255,255,255,0.5);
          font-size: 14px;
          margin-bottom: 16px;
        }
        .btn-browse {
          padding: 10px 24px;
          border-radius: 12px;
          border: none;
          background: #30d158;
          color: #000;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          font-family: inherit;
        }
        .btn-browse:hover {
          background: #28b84d;
        }
        .upload-status {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 16px;
          background: rgba(255,255,255,0.05);
          border-radius: 12px;
          margin-bottom: 16px;
          color: rgba(255,255,255,0.7);
          font-size: 14px;
        }
        .status-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.2);
          border-top-color: #30d158;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .upload-result {
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 16px;
          font-size: 14px;
        }
        .upload-result.success {
          background: rgba(48, 209, 88, 0.1);
          border: 1px solid rgba(48, 209, 88, 0.3);
          color: #30d158;
        }
        .upload-result.error {
          background: rgba(255, 69, 58, 0.1);
          border: 1px solid rgba(255, 69, 58, 0.3);
          color: #ff453a;
        }
      </style>
    `;
    document.body.appendChild(modal);
  }
  
  modal.style.display = 'grid';
  if (!mounted) mountHandlers();
  resetUploadUI();
}

export function hideStructureUpload() {
  const modal = document.getElementById(MODAL_ID);
  if (modal) modal.style.display = 'none';
}

function resetUploadUI() {
  const status = document.getElementById('upload-status');
  const result = document.getElementById('upload-result');
  if (status) status.style.display = 'none';
  if (result) {
    result.style.display = 'none';
    result.className = 'upload-result';
    result.innerHTML = '';
  }
}

function mountHandlers() {
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('csv-file-input');
  const browseBtn = document.getElementById('browse-btn');
  const closeBtn = document.getElementById('close-structure-upload');

  browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  uploadArea.addEventListener('click', () => fileInput.click());

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  closeBtn.addEventListener('click', hideStructureUpload);

  mounted = true;
}

async function handleFile(file) {
  if (!file.name.match(/\.(csv|txt)$/i)) {
    showToast('Por favor selecciona un archivo CSV', 'error');
    return;
  }

  const status = document.getElementById('upload-status');
  const result = document.getElementById('upload-result');
  const tournamentIdInput = document.getElementById('upload-tournament-id');
  const tournamentId = tournamentIdInput ? tournamentIdInput.value.trim() || 'currentTournament' : currentTournamentId;
  
  status.style.display = 'flex';
  result.style.display = 'none';

  try {
    const text = await file.text();
    const apiKey = 'n9hKejFLbygJO6tDdikCBT0H4Q5A8Isw';
    
    const response = await fetch(`${API_BASE}?key=${apiKey}&tournament=${encodeURIComponent(tournamentId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: text }),
    });

    const data = await response.json();

    status.style.display = 'none';
    result.style.display = 'block';

    if (data.ok) {
      result.className = 'upload-result success';
      result.innerHTML = `
        <strong>✅ Estructura cargada correctamente</strong><br>
        <span style="opacity:0.8">${data.rounds} niveles, ${data.breaks} descansos</span><br>
        <span style="opacity:0.6;font-size:12px">Torneo: ${tournamentId}</span>
      `;
      showToast('Estructura del torneo cargada', 'success');
    } else {
      result.className = 'upload-result error';
      result.innerHTML = `<strong>❌ Error:</strong> ${data.error || 'Formato no válido'}`;
    }
  } catch (err) {
    status.style.display = 'none';
    result.style.display = 'block';
    result.className = 'upload-result error';
    result.innerHTML = `<strong>❌ Error:</strong> No se pudo conectar al servidor`;
    console.error(err);
  }
}
