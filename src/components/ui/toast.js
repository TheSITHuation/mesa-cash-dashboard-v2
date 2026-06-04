// src/components/ui/toast.js
// Vanilla-JS toast system. Reemplaza alert() con feedback inline que
// respeta prefers-reduced-motion y anuncia a screen readers via aria-live.

import './toast.css';

let container = null;
let assertive = null;
let polite = null;

function ensureContainer() {
  if (container && document.body.contains(container)) return container;

  container = document.createElement('div');
  container.className = 'dg-toast-container';
  container.setAttribute('aria-atomic', 'true');

  // polite region for info/success/warning
  polite = document.createElement('div');
  polite.setAttribute('role', 'status');
  polite.setAttribute('aria-live', 'polite');
  polite.className = 'visually-hidden';

  // assertive region for errors
  assertive = document.createElement('div');
  assertive.setAttribute('role', 'alert');
  assertive.setAttribute('aria-live', 'assertive');
  assertive.className = 'visually-hidden';

  document.body.appendChild(container);
  document.body.appendChild(polite);
  document.body.appendChild(assertive);
  return container;
}

function iconFor(type) {
  switch (type) {
    case 'success': return '✓';
    case 'error':   return '!';
    case 'warning': return '!';
    case 'info':
    default:        return 'i';
  }
}

function announce(type, message) {
  if (!message) return;
  if (!assertive || !polite) ensureContainer();
  const region = type === 'error' ? assertive : polite;
  region.textContent = '';
  // microtask delay to ensure SR picks up the change
  setTimeout(() => { region.textContent = message; }, 30);
}

function build({ type = 'info', title, message, duration = 4500 } = {}) {
  ensureContainer();

  const toast = document.createElement('div');
  toast.className = `dg-toast dg-toast--${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  const icon = document.createElement('div');
  icon.className = 'dg-toast-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = iconFor(type);

  const body = document.createElement('div');
  body.className = 'dg-toast-body';

  if (title) {
    const t = document.createElement('div');
    t.className = 'dg-toast-title';
    t.textContent = title;
    body.appendChild(t);
  }
  if (message) {
    const m = document.createElement('div');
    m.className = 'dg-toast-message';
    m.textContent = message;
    body.appendChild(m);
  }

  const close = document.createElement('button');
  close.className = 'dg-toast-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Cerrar notificación');
  close.textContent = '×';
  close.addEventListener('click', () => dismiss(toast));

  toast.append(icon, body, close);
  container.appendChild(toast);
  announce(type, title ? `${title}. ${message || ''}` : message);

  if (duration > 0) {
    setTimeout(() => dismiss(toast), duration);
  }
  return toast;
}

function dismiss(toast) {
  if (!toast || !toast.isConnected) return;
  toast.classList.add('dg-toast--out');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
  // Fallback if animationend doesn't fire (reduced motion)
  setTimeout(() => { if (toast.isConnected) toast.remove(); }, 400);
}

export function showToast(message, options = {}) {
  return build({ type: 'info', message, ...options });
}

export function showSuccess(message, options = {}) {
  return build({ type: 'success', message, ...options });
}

export function showError(message, options = {}) {
  return build({ type: 'error', message, duration: 6000, ...options });
}

export function showWarning(message, options = {}) {
  return build({ type: 'warning', message, duration: 5500, ...options });
}

export default { showToast, showSuccess, showError, showWarning };
