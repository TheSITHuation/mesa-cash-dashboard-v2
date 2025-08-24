// src/components/start-screen/start-screen.js

import { renderCreateTableForm } from '../table-settings-modal/table-form.js';

export function renderStartScreen() {
  const container = document.getElementById('app');
  if (!container) return;

  // Limpia cualquier contenido previo
  container.innerHTML = '';

  // Crea el wrapper
  const screen = document.createElement('div');
  screen.className = 'start-screen';

  // Logo
  const logo = document.createElement('div');
  logo.className = 'start-screen__logo';
  const img = document.createElement('img');
  img.src = 'public/casino-logo.png'; // Ruta ya válida desde /public
  img.alt = 'Logo del Casino';
  logo.appendChild(img);

  // Botón
  const overlay = document.createElement('div');
  overlay.className = 'start-screen__overlay';
  const button = document.createElement('button');
  button.className = 'start-screen__button';
  button.textContent = 'Crear Mesa';
  overlay.appendChild(button);

  // Acciones
  button.addEventListener('click', () => {
    destroyStartScreen();
    renderCreateTableForm(); // Asegúrate de tener esto importado
  });

  // Ensambla
  screen.appendChild(logo);
  screen.appendChild(overlay);
  container.appendChild(screen);

  // ✅ Aplica estilo global para desactivar márgenes/paddings
  document.body.classList.add('start-screen-active');
}

export function destroyStartScreen() {
  const screen = document.querySelector('.start-screen');
  if (!screen) return;

  screen.classList.add('fade-out');

  screen.addEventListener('animationend', () => {
    screen.remove();
    document.body.classList.remove('start-screen-active');
  }, { once: true });
}

