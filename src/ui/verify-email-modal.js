// src/ui/verify-email-modal.js
import { sendVerification, logout } from '../services/config/firebaseConfig.js';
import { showToast } from './toast.js';

const MODAL_ID = 'verify-email-modal';
let mounted = false;
let currentUser = null;

export function showVerifyEmail(user) {
  currentUser = user;
  let modal = document.getElementById(MODAL_ID);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'login-backdrop';
    modal.innerHTML = `
      <div class="login-card verify-card">
        <div class="verify-icon">📧</div>
        <h3>Verifica tu Email</h3>
        <p class="verify-message">
          Hemos enviado un email de verificación a:<br>
          <strong id="verify-email-display">${user?.email || ''}</strong>
        </p>
        <p class="verify-submessage">
          Revisa tu bandeja de entrada (y spam) y haz clic en el enlace de verificación.
        </p>
        <button id="resend-verify-btn" type="button">Reenviar Email</button>
        <button id="check-verify-btn" type="button" class="btn-secondary">Ya verifiqué mi email</button>
        <button id="logout-verify-btn" type="button" class="btn-logout">Cerrar Sesión</button>
        <p id="verify-error" class="login-error"></p>
      </div>

      <style>
        .verify-card {
          width: min(95vw, 400px);
          text-align: center;
          animation: modalScaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .verify-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        .verify-message {
          color: rgba(255,255,255,0.7);
          font-size: 14px;
          line-height: 1.6;
          margin-bottom: 8px;
        }
        .verify-message strong {
          color: #fff;
          word-break: break-all;
        }
        .verify-submessage {
          color: rgba(255,255,255,0.5);
          font-size: 12px;
          margin-bottom: 24px;
        }
        #resend-verify-btn {
          width: 100%;
          padding: 12px;
          border-radius: 12px;
          border: none;
          background: #30d158;
          color: #000;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          margin-bottom: 10px;
          font-family: inherit;
        }
        #resend-verify-btn:hover {
          background: #28b84d;
        }
        #resend-verify-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-secondary {
          width: 100%;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,0.2);
          background: transparent;
          color: #fff;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
          margin-bottom: 10px;
          font-family: inherit;
        }
        .btn-secondary:hover {
          background: rgba(255,255,255,0.1);
        }
        .btn-logout {
          width: 100%;
          padding: 10px;
          border-radius: 12px;
          border: none;
          background: transparent;
          color: rgba(255,255,255,0.4);
          font-size: 13px;
          cursor: pointer;
          font-family: inherit;
        }
        .btn-logout:hover {
          color: #ff453a;
        }
      </style>
    `;
    document.body.appendChild(modal);
  }
  
  const emailDisplay = document.getElementById('verify-email-display');
  if (emailDisplay && user?.email) {
    emailDisplay.textContent = user.email;
  }
  
  modal.style.display = 'grid';
  if (!mounted) mountHandlers();
}

export function hideVerifyEmail() {
  const modal = document.getElementById(MODAL_ID);
  if (modal) modal.style.display = 'none';
}

function mountHandlers() {
  const resendBtn = document.getElementById('resend-verify-btn');
  const checkBtn = document.getElementById('check-verify-btn');
  const logoutBtn = document.getElementById('logout-verify-btn');
  const errEl = document.getElementById('verify-error');

  resendBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    errEl.textContent = '';
    resendBtn.disabled = true;
    resendBtn.textContent = 'Enviando...';
    
    try {
      await sendVerification(currentUser);
      showToast('Email de verificación reenviado.', 'success');
      resendBtn.textContent = 'Reenviar Email';
      resendBtn.disabled = false;
    } catch (err) {
      console.error(err);
      errEl.textContent = 'No se pudo reenviar el email. Intenta de nuevo.';
      resendBtn.textContent = 'Reenviar Email';
      resendBtn.disabled = false;
    }
  });

  checkBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    errEl.textContent = '';
    checkBtn.disabled = true;
    checkBtn.textContent = 'Verificando...';
    
    try {
      await currentUser.reload();
      if (currentUser.emailVerified) {
        showToast('¡Email verificado correctamente!', 'success');
        hideVerifyEmail();
      } else {
        errEl.textContent = 'Tu email aún no ha sido verificado. Revisa tu bandeja de entrada.';
        checkBtn.disabled = false;
        checkBtn.textContent = 'Ya verifiqué mi email';
      }
    } catch (err) {
      console.error(err);
      errEl.textContent = 'Error al verificar. Intenta de nuevo.';
      checkBtn.disabled = false;
      checkBtn.textContent = 'Ya verifiqué mi email';
    }
  });

  logoutBtn.addEventListener('click', async () => {
    try {
      await logout();
      hideVerifyEmail();
    } catch (err) {
      console.error(err);
      errEl.textContent = 'Error al cerrar sesión.';
    }
  });

  mounted = true;
}
