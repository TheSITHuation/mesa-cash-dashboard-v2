// src/services/firebase/absenceService.js
import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { db } from '../config/firebaseConfig.js';

/**
 * Marca un jugador como ausente:
 * - Pausa su timer personal
 * - Guarda absentSince y absent: true
 */
export async function markPlayerAbsent(tableId, seatId) {
  if (!tableId || !seatId) throw new Error('[absenceService] tableId y seatId requeridos');

  const ref = doc(db, 'tables', tableId, 'seats', seatId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('[absenceService] asiento no encontrado');

  const seat = snap.data();
  const now  = Date.now();

  // Acumular el tiempo jugado hasta este momento antes de pausar
  const ptTotal = Number(seat?.playTime?.totalMs || 0);
  const ptLast  = Number(seat?.playTime?.lastTick || now);
  const accumulated = ptTotal + Math.max(0, now - ptLast);

  await updateDoc(ref, {
    absent:      true,
    absentSince: now,
    playTime: {
      totalMs:  accumulated,
      lastTick: now,
      paused:   true,
    },
    updatedAt: serverTimestamp(),
  });
}

/**
 * Marca un jugador como de vuelta:
 * - Reanuda su timer personal
 * - Limpia absent y absentSince
 */
export async function markPlayerReturned(tableId, seatId) {
  if (!tableId || !seatId) throw new Error('[absenceService] tableId y seatId requeridos');

  const ref = doc(db, 'tables', tableId, 'seats', seatId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('[absenceService] asiento no encontrado');

  const seat = snap.data();
  const now  = Date.now();

  await updateDoc(ref, {
    absent:      false,
    absentSince: null,
    playTime: {
      totalMs:  Number(seat?.playTime?.totalMs || 0),
      lastTick: now,
      paused:   false,
    },
    updatedAt: serverTimestamp(),
  });
}
