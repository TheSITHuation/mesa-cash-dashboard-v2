// src/services/firebase/tableService.js
import { db } from '../config/firebaseConfig.js';
import { getTableId } from '../../utils/getTableId.js';
import { reserveNextSlot, releaseSlot } from './tableSlotsService.js';
import { initSeatsForTable } from './initSeatsForTable.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  query,
  orderBy,
} from 'firebase/firestore';

const TABLES = 'tables';

/* =========================
   LECTURAS / LISTENERS
   ========================= */

/** Escucha todas las mesas en tiempo real (ordenadas por createdAt desc). */
export function listenTables(cb) {
  const q = query(collection(db, TABLES), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    cb(rows);
  });
}

/** Obtiene todas las mesas (una sola lectura, no realtime). */
export async function getTablesOnce() {
  const q = query(collection(db, TABLES), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** Escucha los asientos de una mesa (por defecto usa el id de la URL). */
export function listenToSeats(callback, tableIdOverride) {
  const tableId = tableIdOverride || getTableId();
  if (!tableId) return () => {};

  const seatsCol = collection(db, TABLES, tableId, 'seats');
  return onSnapshot(seatsCol, (querySnapshot) => {
    const seats = {};
    querySnapshot.forEach((d) => { seats[d.id] = d.data(); });
    callback(seats);
  });
}

/** Escucha un documento de mesa (datos de la mesa). */
export function listenToTableData(callback, tableIdOverride) {
  const tableId = tableIdOverride || getTableId();
  if (!tableId) return () => {};

  const ref = doc(db, TABLES, tableId);
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

/** Obtiene una mesa por id (una sola lectura). */
export async function getTable(tableId) {
  const ref = doc(db, TABLES, tableId);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** Devuelve sólo el status de la mesa. */
export async function getMesaStatus(tableIdOverride) {
  const tableId = tableIdOverride || getTableId();
  if (!tableId) return null;
  const ref = doc(db, TABLES, tableId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return data?.status ?? null;
}

/* =========================
   ESCRITURAS / MUTACIONES
   ========================= */

/** Crea una mesa nueva con slot dinámico (Table-1, Table-2, etc.). */
export async function createTable(payload = {}, slotId = null) {
  const now = serverTimestamp();
  
  // Reservar el slot (específico o el siguiente disponible)
  const { tableId, slotNumber } = await reserveNextSlot(slotId);
  
  // Calcular sortOrder automático (último + 1)
  const existingSnap = await getDocs(collection(db, TABLES));
  const sortOrder = existingSnap.size + 1;

  const data = {
    name:        payload.name || `Table-${slotNumber}`,
    slotNumber,
    gameType:    payload.gameType || 'NLHE',
    smallBlind:  payload.smallBlind ?? 0,
    bigBlind:    payload.bigBlind ?? 0,
    minBuyIn:    payload.minBuyIn ?? 0,
    maxBuyIn:    payload.maxBuyIn ?? 0,
    maxSeats:    payload.maxSeats ?? 9,
    status:      payload.status || 'inactive',
    active:      !!payload.active,
    publicLobby: payload.publicLobby !== undefined ? !!payload.publicLobby : true,
    seatsOccupied: payload.seatsOccupied ?? 0,
    waitingCount:  payload.waitingCount  ?? 0,
    dealerAvatar: payload.dealerAvatar || '/avatars/dealer1.png',
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };

  // Usar setDoc con el ID del slot en lugar de addDoc con ID auto-generado
  await setDoc(doc(db, TABLES, tableId), data);

  // Inicializar documentos de asientos según maxSeats
  await initSeatsForTable(tableId, data.maxSeats);

  return tableId;
}


/** Actualiza campos de una mesa. */
export async function updateTable(id, patch) {
  const ref = doc(db, TABLES, id);
  await updateDoc(ref, { ...patch, updatedAt: serverTimestamp() });
  return true;
}

/** Borra una mesa por id, limpia subcolecciones y libera su slot. */
export async function deleteTable(id) {
  // 1. Limpiar subcolección de asientos
  const seatsRef = collection(db, TABLES, id, 'seats');
  const seatsSnap = await getDocs(seatsRef);
  const seatDeletions = seatsSnap.docs.map(d => deleteDoc(d.ref));
  await Promise.all(seatDeletions);

  // 2. Limpiar subcolección de lista de espera
  const waitingRef = collection(db, TABLES, id, 'waitingList');
  const waitingSnap = await getDocs(waitingRef);
  const waitingDeletions = waitingSnap.docs.map(d => deleteDoc(d.ref));
  await Promise.all(waitingDeletions);

  // 3. Borrar documento principal de la mesa
  await deleteDoc(doc(db, TABLES, id));
  
  // 4. Liberar el slot
  await releaseSlot(id);
  return true;
}

/**
 * Activa una mesa (y desactiva las demás).
 * Si pasas `null`, desactiva todas.
 */
export async function setActiveTable(targetId = null) {
  const snap = await getDocs(collection(db, TABLES));
  const batch = writeBatch(db);

  snap.forEach((d) => {
    const ref = doc(db, TABLES, d.id);
    const isTarget = targetId && d.id === targetId;
    batch.update(ref, {
      active: !!isTarget,
      status: isTarget ? 'active' : (d.data().status === 'active' ? 'inactive' : d.data().status),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
  return true;
}

/** Cambia sólo el `status` de la mesa actual (o indicada). */
export async function updateTableStatus(newStatus, tableIdOverride) {
  const tableId = tableIdOverride || getTableId();
  if (!tableId) throw new Error('updateTableStatus: tableId requerido');
  const ref = doc(db, TABLES, tableId);
  await updateDoc(ref, { status: newStatus, updatedAt: serverTimestamp() });
  return newStatus;
}
// ─────────────────────────────────────────────────────────────────────────────
// CONTROL DE SESIÓN + TIMERS DE ASIENTOS (reutilizable por Panel y Gestor)
// ─────────────────────────────────────────────────────────────────────────────

// Pausa todos los timers de asientos ocupados
export async function pauseAllSeatTimers(tableIdOverride) {
  const tableId = tableIdOverride || getTableId();
  if (!tableId) return;
  const colRef = collection(db, 'tables', tableId, 'seats');
  const qs = await getDocs(colRef);
  const now = Date.now();
  const batch = writeBatch(db);
  qs.forEach((d) => {
    const seat = d.data();
    if (!seat || seat.status !== 'occupied') return;
    const pt = seat.playTime || {};
    const last = typeof pt.lastTick === 'number' ? pt.lastTick : now;
    const base = Number(pt.totalMs || 0);
    const delta = Math.max(0, now - last);
    batch.update(d.ref, {
      playTime: { totalMs: base + delta, lastTick: now, paused: true },
      updatedAt: serverTimestamp()
    });
  });
  await batch.commit();
}

// Reanuda timers de asientos ocupados
export async function resumeAllSeatTimers(tableIdOverride) {
  const tableId = tableIdOverride || getTableId();
  if (!tableId) return;
  const colRef = collection(db, 'tables', tableId, 'seats');
  const qs = await getDocs(colRef);
  const now = Date.now();
  const batch = writeBatch(db);
  qs.forEach((d) => {
    const seat = d.data();
    if (!seat || seat.status !== 'occupied') return;
    const pt = seat.playTime || {};
    batch.update(d.ref, {
      playTime: { totalMs: Number(pt.totalMs || 0), lastTick: now, paused: false },
      updatedAt: serverTimestamp()
    });
  });
  await batch.commit();
}

// Sesión a nivel mesa
export async function startSession(tableIdOverride) {
  const tableId = tableIdOverride || getTableId();
  // Use local timestamp for immediate UI update, serverTimestamp syncs later
  await updateDoc(doc(db, TABLES, tableId), {
    sessionState: 'running',
    sessionStartAt: Date.now(),
    pauseStartedAt: null,
    pausedTotalMs: 0,
    updatedAt: serverTimestamp(),
  });
}
export async function pauseSession(tableIdOverride) {
  const tableId = tableIdOverride || getTableId();
  await updateDoc(doc(db, TABLES, tableId), {
    sessionState: 'paused',
    pauseStartedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}
export async function resumeSession(tableIdOverride) {
  const tableId = tableIdOverride || getTableId();
  const ref = doc(db, TABLES, tableId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const d = snap.data();
  const pauseStartedAtMs = d?.pauseStartedAt?.toMillis?.() ?? null;
  const pausedTotalMs    = Number(d?.pausedTotalMs || 0);
  const extra            = pauseStartedAtMs ? (Date.now() - pauseStartedAtMs) : 0;
  await updateDoc(ref, {
    sessionState: 'running',
    pauseStartedAt: null,
    pausedTotalMs: pausedTotalMs + extra,
    updatedAt: serverTimestamp(),
  });
}
export async function resetSession(tableIdOverride) {
  const tableId = tableIdOverride || getTableId();
  await updateDoc(doc(db, TABLES, tableId), {
    sessionState: 'idle',
    sessionStartAt: null,
    pauseStartedAt: null,
    pausedTotalMs: 0,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Set de alto nivel para reflejar “Play / Pause / Stop”:
 *  - status: 'activa' | 'en espera' | 'inactiva'
 *  - sincroniza sessionState y timers de asientos
 */
export async function setStatusAndSession(status, tableIdOverride) {
  const tableId = tableIdOverride || getTableId();
  if (!tableId) throw new Error('setStatusAndSession: tableId requerido');

  // status de la mesa (para UI)
  await updateTableStatus(status, tableId);

  if (status === 'activa') {
    await resumeAllSeatTimers(tableId);
    await resumeSession(tableId); // o startSession si venía en idle
  } else if (status === 'en espera') {
    await pauseAllSeatTimers(tableId);
    await pauseSession(tableId);
  } else { // 'inactiva'
    await pauseAllSeatTimers(tableId);
    await resetSession(tableId);
  }
  return status;
}
