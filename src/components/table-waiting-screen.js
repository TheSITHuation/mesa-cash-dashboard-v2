// src/components/table-waiting-screen.js
/**
 * Pantalla "En espera" para tablets cuando no hay juego activo.
 * Muestra logo animado con fondo dinámico y permite iniciar el juego.
 */

import { setStatusAndSession } from '../services/firebase/tableService.js';
import { db } from '../services/config/firebaseConfig.js';
import { doc, getDoc } from 'firebase/firestore';

export async function renderWaitingScreen(tableData, container) {
  const { id, name, slotNumber, gameType, smallBlind, bigBlind, maxSeats, tableConfig } = tableData;
  
  const tableRef = doc(db, 'tables', id);
  const snap = await getDoc(tableRef);
  let mesaExiste = snap.exists();
  let mesaData = mesaExiste ? { id: snap.id, ...snap.data() } : null;
  
  function renderUI() {
    container.innerHTML = `
      <div class="waiting-screen">
        <canvas class="waiting-screen__bg" id="waiting-bg-canvas"></canvas>
        <div class="waiting-screen__content">
          <div class="waiting-screen__logo">
            <img class="waiting-screen__logo-img" src="/branding/logo.png" alt="Logo" />
          </div>
          <h1 class="waiting-screen__title">${mesaData?.name || name || `Table-${slotNumber}`}</h1>
          <p class="waiting-screen__subtitle">${mesaExiste ? 'En espera' : 'Sin configurar'}</p>
          <button class="waiting-screen__btn" id="waiting-start-btn" ${!mesaExiste ? 'disabled' : ''}>
            <span class="waiting-screen__btn-icon">${mesaExiste ? '▶' : ''}</span>
            ${mesaExiste ? 'Iniciar Juego' : 'Mesa no configurada'}
          </button>
        </div>
      </div>
    `;

    initBackgroundAnimation(container.querySelector('#waiting-bg-canvas'));

    const startBtn = container.querySelector('#waiting-start-btn');
    if (startBtn && mesaExiste) {
      startBtn.addEventListener('click', async () => {
        startBtn.disabled = true;
        startBtn.innerHTML = '<span class="waiting-screen__btn-icon waiting-screen__btn-icon--spin"></span> Iniciando...';
        
        try {
          await setStatusAndSession('activa', id);
          location.reload();
        } catch (e) {
          console.error('[waiting-screen] Error al iniciar:', e);
          startBtn.disabled = false;
          startBtn.innerHTML = '<span class="waiting-screen__btn-icon">▶</span> Iniciar Juego';
          alert('No se pudo iniciar el juego. Intenta de nuevo.');
        }
      });
    }
  }

  renderUI();

  // Escuchar cuando la mesa es creada desde el gestor
  const bc = new BroadcastChannel('poker-tables');
  bc.onmessage = async (e) => {
    if (e.data?.type === 'table-created' && e.data?.tableId === id) {
      // Recargar datos de la mesa
      const newSnap = await getDoc(tableRef);
      if (newSnap.exists()) {
        mesaExiste = true;
        mesaData = { id: newSnap.id, ...newSnap.data() };
        renderUI();
      }
    }
    if (e.data?.type === 'table-deleted' && e.data?.tableId === id) {
      mesaExiste = false;
      mesaData = null;
      renderUI();
    }
  };
}

function initBackgroundAnimation(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let animationId;
  let particles = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createParticles() {
    particles = [];
    const count = Math.floor((canvas.width * canvas.height) / 15000);
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 2 + 0.5,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.5 + 0.1,
        pulse: Math.random() * Math.PI * 2,
      });
    }
  }

  function draw() {
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Gradiente radial central
    const gradient = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 0,
      canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.6
    );
    gradient.addColorStop(0, 'rgba(212, 175, 55, 0.08)');
    gradient.addColorStop(0.5, 'rgba(212, 175, 55, 0.02)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Partículas
    particles.forEach(p => {
      p.x += p.speedX;
      p.y += p.speedY;
      p.pulse += 0.02;

      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      const currentOpacity = p.opacity * (0.7 + Math.sin(p.pulse) * 0.3);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(212, 175, 55, ${currentOpacity})`;
      ctx.fill();
    });

    animationId = requestAnimationFrame(draw);
  }

  resize();
  createParticles();
  draw();

  window.addEventListener('resize', () => {
    resize();
    createParticles();
  });

  // Guardar referencia para poder cancelar
  canvas._animationId = animationId;
}

// Estilos CSS
const STYLES = `
.waiting-screen {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0a0a0f;
  z-index: 1000;
  overflow: hidden;
}

.waiting-screen__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.waiting-screen__content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px;
}

.waiting-screen__logo {
  margin-bottom: 32px;
  animation: logo-float 3s ease-in-out infinite;
}

.waiting-screen__logo-img {
  width: 680px;
  height: auto;
  filter: drop-shadow(0 0 40px rgba(212, 175, 55, 0.3));
  display: block;
}

@keyframes logo-float {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-10px) scale(1.05); }
}

.waiting-screen__title {
  margin: 0 0 8px;
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.5px;
  animation: fade-in-up 0.6s ease-out 0.2s both;
}

.waiting-screen__subtitle {
  margin: 0 0 48px;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 3px;
  animation: fade-in-up 0.6s ease-out 0.4s both;
}

.waiting-screen__btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 32px;
  border: none;
  border-radius: 16px;
  background: linear-gradient(135deg, #30d158 0%, #28b84d 100%);
  color: #000;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  font-family: inherit;
  box-shadow: 0 4px 20px rgba(48, 209, 88, 0.3);
  animation: fade-in-up 0.6s ease-out 0.6s both;
}

.waiting-screen__btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(48, 209, 88, 0.4);
}

.waiting-screen__btn:active {
  transform: translateY(0);
}

.waiting-screen__btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.waiting-screen__btn-icon {
  font-size: 14px;
  transition: transform 0.3s ease;
}

.waiting-screen__btn-icon--spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`;

// Inyectar estilos una vez
if (!document.getElementById('waiting-screen-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'waiting-screen-styles';
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);
}
