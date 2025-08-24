// utils/seatTimer.js

const seatTimers = new Map();

/**
 * Inicia el temporizador individual para un asiento.
 * @param {string} seatId - ID del asiento.
 * @param {Date} startTime - Hora de inicio.
 * @param {Function} updateCallback - Función para actualizar el texto.
 */
export function startSeatTimer(seatId, startTime, updateCallback) {
  stopSeatTimer(seatId); // Evita duplicados
  const interval = setInterval(() => {
    const now = new Date();
    const diff = new Date(now - startTime);
    const hh = String(diff.getUTCHours()).padStart(2, '0');
    const mm = String(diff.getUTCMinutes()).padStart(2, '0');
    const ss = String(diff.getUTCSeconds()).padStart(2, '0');
    updateCallback(`${hh}:${mm}:${ss}`);
  }, 1000);

  seatTimers.set(seatId, {
    interval,
    startTime,
    paused: false,
    updateCallback
  });
}

/**
 * Detiene el temporizador de un asiento.
 * @param {string} seatId
 */
export function stopSeatTimer(seatId) {
  const timer = seatTimers.get(seatId);
  if (timer && timer.interval) {
    clearInterval(timer.interval);
  }
  seatTimers.delete(seatId);
}

/**
 * Detiene todos los temporizadores activos.
 */
export function stopAllSeatTimers() {
  for (const [seatId, timer] of seatTimers.entries()) {
    clearInterval(timer.interval);
  }
  seatTimers.clear();
}

/**
 * Pausa el temporizador sin borrar la información.
 */
export function pauseSeatTimer(seatId) {
  const timer = seatTimers.get(seatId);
  if (timer && !timer.paused) {
    clearInterval(timer.interval);
    timer.paused = true;
  }
}

/**
 * Reanuda el temporizador pausado.
 */
export function resumeSeatTimer(seatId, updateCallback) {
  const timer = seatTimers.get(seatId);
  if (timer && timer.paused) {
    startSeatTimer(seatId, timer.startTime, updateCallback);
  }
}
