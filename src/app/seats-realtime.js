// src/app/seats-realtime.js
import { db } from '../services/config/firebaseConfig.js';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

let _unsubscribeSeats = null;
let _cache = { seatsMap: {}, seatsList: [] };

const EMPTY9 = () => ({
  seat_1: { status: 'available', seatNumber: 1 },
  seat_2: { status: 'available', seatNumber: 2 },
  seat_3: { status: 'available', seatNumber: 3 },
  seat_4: { status: 'available', seatNumber: 4 },
  seat_5: { status: 'available', seatNumber: 5 },
  seat_6: { status: 'available', seatNumber: 6 },
  seat_7: { status: 'available', seatNumber: 7 },
  seat_8: { status: 'available', seatNumber: 8 },
  seat_9: { status: 'available', seatNumber: 9 },
});

/**
 * Normaliza el objeto de asientos:
 * - Asegura seatNumber numérico aunque el doc no lo traiga (lo infiere del id "seat_N").
 * - Fusiona lo recibido sobre el esqueleto EMPTY9 para no "perder" asientos inexistentes.
 */
function buildSeatsStateFromSnapshot(qs, preserveEmpty = true) {
  const base = preserveEmpty ? EMPTY9() : {};

  qs.forEach((docSnap) => {
    const id = docSnap.id; // ej. "seat_1"
    const data = docSnap.data() || {};

    // Si el doc no trae seatNumber, lo inferimos del id:
    const inferredSeatNumber =
      typeof data.seatNumber === 'number'
        ? data.seatNumber
        : Number.parseInt(id.split('_')[1], 10) || null;

    base[id] = {
      ...(base[id] || {}),
      ...data,
      seatNumber: inferredSeatNumber,
    };
  });

  // Construimos la lista ordenada por seatNumber (para renders y loops):
  const seatsList = Object.entries(base)
    .map(([id, seat]) => ({ id, ...seat }))
    .sort((a, b) => (a.seatNumber || 0) - (b.seatNumber || 0));

  return { seatsMap: base, seatsList };
}

/**
 * Suscribe al realtime de seats.
 * @param {(payload: {seatsMap: Record<string, any>, seatsList: Array<any>}) => void} onUpdate
 * @param {string} tableId
 * @returns {() => void} función para desuscribir
 */
export function initSeatsRealtime(onUpdate, tableId) {
  if (typeof onUpdate !== 'function') {
    throw new Error('initSeatsRealtime: onUpdate (function) es requerido');
  }
  if (!tableId) {
    console.warn('initSeatsRealtime: tableId no proporcionado, no se suscribe.');
    // devolvemos un noop para no romper llamadas que esperan una función
    return () => {};
  }

  // Cierra suscripción previa si la hubiera
  if (_unsubscribeSeats) {
    _unsubscribeSeats();
    _unsubscribeSeats = null;
  }

  // Query ordenada por seatNumber para consistencia
  const colRef = collection(db, 'tables', tableId, 'seats');
  const qSeats = query(colRef, orderBy('seatNumber', 'asc'));

  _unsubscribeSeats = onSnapshot(
    qSeats,
    (qs) => {
      const state = buildSeatsStateFromSnapshot(qs, /* preserveEmpty */ true);
      _cache = state;
      onUpdate(state);
    },
    (err) => {
      console.error('Seats realtime error:', err);
    }
  );

  return _unsubscribeSeats;
}

export function stopSeatsRealtime() {
  if (_unsubscribeSeats) {
    _unsubscribeSeats();
    _unsubscribeSeats = null;
  }
}

/**
 * Devuelve el último estado recibido sin esperar a un nuevo snapshot.
 * Útil para lógica que necesita leer inmediatamente lo que ya se mostró en UI.
 */
export function getSeatsCache() {
  return _cache;
}
