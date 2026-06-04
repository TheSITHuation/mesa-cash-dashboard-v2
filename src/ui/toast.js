// src/ui/toast.js

/**
 * Muestra una notificación temporal elegante en la parte superior de la pantalla.
 * @param {string} message - El mensaje a mostrar.
 * @param {'success' | 'error' | 'info'} type - El tipo de notificación.
 */
export function showToast(message, type = 'success') {
  const containerId = 'toast-container';
  let container = document.getElementById(containerId);

  if (!container) {
    container = document.createElement('div');
    container.id = containerId;
    container.style.cssText = `
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 11000;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
      width: 100%;
      max-width: 400px;
      padding: 0 20px;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const colors = {
    success: { border: '#30d158', bg: 'rgba(48, 209, 88, 0.15)', icon: '✅' },
    error: { border: '#ff453a', bg: 'rgba(255, 69, 58, 0.15)', icon: '❌' },
    info: { border: '#d4af37', bg: 'rgba(212, 175, 55, 0.15)', icon: '✨' }
  };

  const theme = colors[type] || colors.info;

  toast.style.cssText = `
    pointer-events: auto;
    background: rgba(15, 15, 20, 0.9);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid ${theme.border}44;
    border-left: 4px solid ${theme.border};
    border-radius: 12px;
    padding: 16px 20px;
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    gap: 12px;
    opacity: 0;
    transform: translateY(-20px) scale(0.95);
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  `;

  toast.innerHTML = `
    <span style="font-size: 18px;">${theme.icon}</span>
    <span style="flex: 1;">${message}</span>
  `;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0) scale(1)';
  });

  // Remove after delay
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px) scale(0.95)';
    setTimeout(() => {
      toast.remove();
      if (container.children.length === 0) container.remove();
    }, 400);
  }, 4000);
}
