// src/ui/signup-modal.js
import { registerUser } from '../services/config/firebaseConfig.js';
import { showLogin } from './login-modal.js';
import { showToast } from './toast.js';

const MODAL_ID = 'signup-modal';
let mounted = false;

export function showSignup() {
  let modal = document.getElementById(MODAL_ID);
  if (!modal) {
    modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'login-backdrop';
    modal.innerHTML = `
      <div class="login-card signup-card">
        <h3>Crear Nueva Cuenta</h3>
        <form id="signup-form">
          <label>Nombre Completo</label>
          <input type="text" id="signup-name" required placeholder="Ej. Juan Pérez" />
          
          <label>Email</label>
          <input type="email" id="signup-email" required placeholder="tu@email.com" />
          
          <label>Contraseña</label>
          <input type="password" id="signup-pass" required placeholder="••••••••" />
          
          <div id="pass-requirements" class="pass-reqs">
            <div id="req-len" class="req">✕ Mínimo 8 caracteres</div>
            <div id="req-case" class="req">✕ Mayúscula y minúscula</div>
            <div id="req-sym" class="req">✕ Al menos un símbolo (!@#$)</div>
          </div>

          <label>Confirmar Contraseña</label>
          <input type="password" id="signup-pass-confirm" required placeholder="••••••••" />
          
          <button type="submit" id="signup-submit" disabled>Registrarme ahora</button>
        </form>
        
        <button id="back-to-login-signup" class="btn-text-signup" type="button">Ya tengo cuenta, volver al login</button>
        <p id="signup-error" class="login-error"></p>
      </div>

      <style>
        .signup-card {
          width: min(95vw, 420px);
          animation: modalScaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        .pass-reqs {
          background: rgba(255,255,255,0.03);
          border-radius: 12px;
          padding: 12px;
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .req {
          font-size: 11px;
          color: rgba(255,255,255,0.3);
          transition: color 0.3s ease;
        }
        .req.valid {
          color: #30d158;
        }
        .btn-text-signup {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.4);
          font-size: 13px;
          font-weight: 600;
          margin-top: 20px;
          cursor: pointer;
          text-decoration: underline;
          font-family: inherit;
          width: 100%;
          text-align: center;
        }
        .btn-text-signup:hover {
          color: #fff;
        }
        #signup-submit:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          filter: grayscale(1);
        }
      </style>
    `;
    document.body.appendChild(modal);
  }
  modal.style.display = 'grid';
  if (!mounted) mountHandlers();
}

export function hideSignup() {
  const modal = document.getElementById(MODAL_ID);
  if (modal) modal.style.display = 'none';
}

function mountHandlers() {
  const form = document.getElementById('signup-form');
  const nameInput = document.getElementById('signup-name');
  const emailInput = document.getElementById('signup-email');
  const passInput = document.getElementById('signup-pass');
  const confirmInput = document.getElementById('signup-pass-confirm');
  const submitBtn = document.getElementById('signup-submit');
  const backBtn = document.getElementById('back-to-login-signup');
  const errEl = document.getElementById('signup-error');

  const reqs = {
    len: document.getElementById('req-len'),
    case: document.getElementById('req-case'),
    sym: document.getElementById('req-sym')
  };

  const validatePassword = () => {
    const val = passInput.value;
    const hasLen = val.length >= 8;
    const hasCase = /[a-z]/.test(val) && /[A-Z]/.test(val);
    const hasSym = /[^A-Za-z0-9]/.test(val);

    reqs.len.classList.toggle('valid', hasLen);
    reqs.len.textContent = (hasLen ? '✓' : '✕') + ' Mínimo 8 caracteres';
    
    reqs.case.classList.toggle('valid', hasCase);
    reqs.case.textContent = (hasCase ? '✓' : '✕') + ' Mayúscula y minúscula';
    
    reqs.sym.classList.toggle('valid', hasSym);
    reqs.sym.textContent = (hasSym ? '✓' : '✕') + ' Al menos un símbolo (!@#$)';

    const isMatch = val === confirmInput.value && val !== '';
    submitBtn.disabled = !(hasLen && hasCase && hasSym && isMatch);
  };

  passInput.addEventListener('input', validatePassword);
  confirmInput.addEventListener('input', validatePassword);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const pass = passInput.value;

    errEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creando cuenta...';

    try {
      await registerUser(email, pass, name);
      showToast(`¡Cuenta creada! Revisa tu email (${email}) para verificar tu cuenta.`, 'success');
      hideSignup();
    } catch (err) {
      console.error(err);
      errEl.textContent = normalizeError(err);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Registrarme ahora';
    }
  });

  backBtn.addEventListener('click', () => {
    hideSignup();
    showLogin();
  });

  mounted = true;
}

function normalizeError(err) {
  const code = err?.code || '';
  if (code.includes('auth/email-already-in-use')) return 'Este correo ya está registrado.';
  if (code.includes('auth/invalid-email')) return 'Correo electrónico inválido.';
  if (code.includes('auth/operation-not-allowed')) return 'El registro por email no está habilitado.';
  return 'No se pudo crear la cuenta. Intenta de nuevo.';
}
