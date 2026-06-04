// src/ui/recovery-modal.js
import { sendRecoveryEmail } from '../services/config/firebaseConfig.js';
import { showLogin } from './login-modal.js';
import { showToast } from './toast.js';

const MODAL_ID = 'recovery-modal';
let mounted = false;

export function showRecovery() {
  let modal = document.getElementById(MODAL_ID);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'login-backdrop'; // Reutilizamos el estilo del backdrop de login
    modal.innerHTML = `
      <div class="login-card recovery-card">
        <div class="recovery-icon">🔑</div>
        <h3>Recuperar Acceso</h3>
        <p class="recovery-desc">
          Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
        </p>
        <form id="recovery-form">
          <label>Email de Registro</label>
          <input type="email" id="recovery-email" required placeholder="tu@email.com" />
          <button type="submit" id="recovery-submit">Enviar Enlace</button>
        </form>
        <button id="back-to-login" class="btn-text" type="button">Volver al Inicio de Sesión</button>
        <p id="recovery-error" class="login-error"></p>
      </div>

      <style>
        .recovery-card {
          max-width: 400px;
          animation: modalScaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .recovery-icon {
          font-size: 40px;
          margin-bottom: 16px;
        }
        .recovery-desc {
          color: rgba(255,255,255,0.5);
          font-size: 14px;
          line-height: 1.5;
          margin-bottom: 24px;
        }
        .btn-text {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.4);
          font-size: 13px;
          font-weight: 600;
          margin-top: 16px;
          cursor: pointer;
          text-decoration: underline;
          font-family: inherit;
        }
        .btn-text:hover {
          color: #fff;
        }
        @keyframes modalScaleIn {
          from { opacity: 0; transform: scale(0.9) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      </style>
    `;
    document.body.appendChild(modal);
  }
  modal.style.display = 'grid';
  if (!mounted) mountHandlers();
}

export function hideRecovery() {
  const modal = document.getElementById(MODAL_ID);
  if (modal) modal.style.display = 'none';
}

function mountHandlers() {
  const form = document.getElementById('recovery-form');
  const emailInput = document.getElementById('recovery-email');
  const backBtn = document.getElementById('back-to-login');
  const errEl = document.getElementById('recovery-error');
  const submitBtn = document.getElementById('recovery-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    if (!email) return;

    errEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';

    try {
      await sendRecoveryEmail(email);
      showToast('¡Enlace enviado! Revisa tu bandeja de entrada.');
      
      // Volver al login tras un breve delay
      setTimeout(() => {
        hideRecovery();
        showLogin();
      }, 1500);

    } catch (err) {
      console.error(err);
      errEl.textContent = normalize(err);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar Enlace';
    }
  });

  backBtn.addEventListener('click', () => {
    hideRecovery();
    showLogin();
  });

  mounted = true;
}

function normalize(err) {
  const code = err?.code || '';
  if (code.includes('auth/user-not-found')) return 'No hay ninguna cuenta con este correo.';
  if (code.includes('auth/invalid-email')) return 'Correo electrónico inválido.';
  return 'Error al enviar el enlace. Intenta de nuevo.';
}
