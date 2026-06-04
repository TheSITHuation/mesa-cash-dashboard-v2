// src/ui/pendingArrivalNotification.js
import { emitOpenSeatModal } from '../utils/modalBridge.js';
import { completeArrival, dismissArrival } from '../services/firebase/pendingArrivalsService.js';
import { getTableId } from '../utils/getTableId.js';

let activeNotifications = [];
let container = null;

function getContainer() {
  if (!container) {
    container = document.createElement('div');
    container.id = 'pending-arrivals-container';
    container.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 9500;
      display: flex; flex-direction: column; gap: 10px;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }
  return container;
}

function createNotification(arrival) {
  const tableId = getTableId();
  const el = document.createElement('div');
  el.style.cssText = `
    pointer-events: auto;
    background: linear-gradient(135deg, rgba(251,191,36,.12), rgba(251,191,36,.04));
    border: 1px solid rgba(251,191,36,.35);
    border-radius: 14px;
    padding: 14px 18px;
    min-width: 280px;
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 32px rgba(0,0,0,.5), 0 0 40px rgba(251,191,36,.08);
    transform: translateX(120%);
    transition: transform .4s cubic-bezier(.34,1.56,.64,1);
    cursor: default;
  `;
  el.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px">
      <div style="flex-shrink:0;width:36px;height:36px;border-radius:50%;background:rgba(251,191,36,.2);display:flex;align-items:center;justify-content:center;font-size:18px">🔔</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:15px;font-weight:700;color:#fbbf24;letter-spacing:.3px">Jugador en camino</div>
        <div style="font-size:18px;font-weight:400;color:#fff;margin:4px 0 2px">${escapeHtml(arrival.playerName)}</div>
        <div style="font-size:11px;color:rgba(255,255,255,.35);letter-spacing:.5px">${arrival.gameType || ''} ${arrival.smallBlind || 0}/${arrival.bigBlind || 0}</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="pa-receive" style="flex:1;padding:7px 0;border-radius:8px;border:1px solid rgba(251,191,36,.4);background:linear-gradient(135deg,rgba(251,191,36,.2),rgba(251,191,36,.08));color:#fbbf24;font-family:inherit;font-size:12px;font-weight:700;letter-spacing:.5px;cursor:pointer">Recepcionar</button>
      <button class="pa-dismiss" style="padding:7px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);color:rgba(255,255,255,.3);font-family:inherit;font-size:11px;cursor:pointer">✕</button>
    </div>
  `;

  // animate in
  requestAnimationFrame(() => { el.style.transform = 'translateX(0)'; });

  el.querySelector('.pa-receive').addEventListener('click', async () => {
    await completeArrival(tableId, arrival.id);
    emitOpenSeatModal({ playerFromWaiting: { name: arrival.playerName } });
    remove(el);
  });

  el.querySelector('.pa-dismiss').addEventListener('click', async () => {
    await dismissArrival(tableId, arrival.id);
    remove(el);
  });

  function remove(target) {
    target.style.transform = 'translateX(120%)';
    target.style.opacity = '0';
    target.style.transition = 'transform .3s ease-in, opacity .2s ease-in';
    setTimeout(() => {
      if (target.parentNode) target.parentNode.removeChild(target);
    }, 350);
    activeNotifications = activeNotifications.filter(n => n.el !== target);
  }

  getContainer().appendChild(el);
  activeNotifications.push({ id: arrival.id, el });

  // auto-dismiss after 30s
  setTimeout(() => {
    if (el.parentNode) {
      dismissArrival(tableId, arrival.id);
      remove(el);
    }
  }, 30000);
}

export function initPendingArrivalsListener(tableId, listenFn) {
  return listenFn(tableId, (arrivals) => {
    const currentIds = new Set(activeNotifications.map(n => n.id));
    arrivals.forEach(a => {
      if (!currentIds.has(a.id)) {
        createNotification(a);
      }
    });
  });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
