// src/ui/login-modal.js
import { loginWithEmail, loginWithGoogle } from '../services/config/firebaseConfig.js';
import { showRecovery } from './recovery-modal.js';
import { showSignup } from './signup-modal.js';


const MODAL_ID = 'login-modal';
let mounted = false;
function isLobbyRoute() {
  const href = String(location.href);
  const path = String(location.pathname || '');
  const hash = String(location.hash || '');
  return (
    /[?&#](lobby=1)\b/i.test(href) ||
    /[?&#](view=lobby)\b/i.test(href) ||
    hash === '#/lobby' ||
    /(^|\/)lobby\/?$/.test(path)
  );
}

export function showLogin() {
  if (isLobbyRoute()) return; // ← nunca mostrar en lobby
  let modal = document.getElementById(MODAL_ID);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'login-backdrop';
    modal.innerHTML = `
      <div class="login-card">
        <h3>Acceso a Gestión Poker</h3>
        <form id="login-form">
          <label>Email</label>
          <input type="email" id="login-email" required />
          <label>Password</label>
          <input type="password" id="login-pass" required />
          <div style="text-align: right; margin-top: -8px; margin-bottom: 16px;">
            <a id="forgot-link" style="color: #d4af37; font-size: 11px; text-decoration: none; font-weight: 600; cursor: pointer;">¿Olvidaste tu contraseña?</a>
          </div>
          <button type="submit">Entrar</button>
        </form>
        <div class="login-sep">o</div>
        <button id="google-btn" type="button">Continuar con Google</button>
        <div style="margin-top: 24px; text-align: center; font-size: 13px; color: rgba(255,255,255,0.4);">
          ¿No tienes una cuenta? <br>
          <a id="signup-link" style="color: #d4af37; font-weight: 700; text-decoration: none; cursor: pointer;">Regístrate aquí</a>
        </div>
        <p id="login-error" class="login-error"></p>
      </div>
    `;
    document.body.appendChild(modal);
  }
  modal.style.display = 'grid';
  if (!mounted) mountHandlers();
}

export function hideLogin() {
  const modal = document.getElementById(MODAL_ID);
  if (modal) modal.style.display = 'none';
}

function mountHandlers() {
  const form = document.getElementById('login-form');
  const email = document.getElementById('login-email');
  const pass  = document.getElementById('login-pass');
  const gbtn  = document.getElementById('google-btn');
  const errEl = document.getElementById('login-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.textContent = '';
    try {
      await loginWithEmail(email.value.trim(), pass.value.trim());
    } catch (err) {
      errEl.textContent = normalize(err);
    }
  });

  gbtn.addEventListener('click', async () => {
    errEl.textContent = '';
    try {
      await loginWithGoogle();
    } catch (err) {
      errEl.textContent = normalize(err);
    }
  });

  const forgotLink = document.getElementById('forgot-link');
  if (forgotLink) {
    forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      hideLogin();
      showRecovery();
    });
  }

  const signupLink = document.getElementById('signup-link');
  if (signupLink) {
    signupLink.addEventListener('click', (e) => {
      e.preventDefault();
      hideLogin();
      showSignup();
    });
  }

  mounted = true;
}

function normalize(err) {
  const code = err?.code || '';
  if (code.includes('auth/invalid-credential')) return 'Credenciales inválidas.';
  if (code.includes('auth/too-many-requests'))  return 'Demasiados intentos. Intenta más tarde.';
  return 'No se pudo iniciar sesión.';
}
