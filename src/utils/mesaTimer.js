// Estructura inicial sugerida para separar claramente los timers

// src/utils/mesaTimer.js

import { getTableId } from '../utils/getTableId.js';
import { db } from '../services/config/firebaseConfig.js';
import { doc, onSnapshot } from 'firebase/firestore';

let mesaStatus = 'inactiva';
let mesaStartTime = null;
let mesaInterval = null;
let mesaCallback = () => {};

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
  const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  const s = String(totalSec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function listenToMesaTimer(callback) {
  const tableId = getTableId();
  mesaCallback = callback;

  const tableRef = doc(db, 'tables', tableId);
  return onSnapshot(tableRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();

    mesaStatus = data.status;
    mesaStartTime = data.sessionStartTime?.toDate?.() || null;

    if (mesaStatus === 'activa' && mesaStartTime) {
      startMesaTimer(mesaStartTime);
    } else {
      stopMesaTimer();
    }
  });
}

function startMesaTimer(startTime) {
  stopMesaTimer(); // Limpia si había uno previo
  mesaInterval = setInterval(() => {
    const now = new Date();
    const elapsed = now - startTime;
    mesaCallback(formatTime(elapsed));
  }, 1000);
}

function stopMesaTimer() {
  if (mesaInterval) {
    clearInterval(mesaInterval);
    mesaInterval = null;
  }
}
