// src/services/firebase/waitingListService.js
import { db } from '../config/firebaseConfig.js';
import { doc, setDoc, addDoc, deleteDoc, serverTimestamp, collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';

/** Convierte el nombre en una clave estable (sin acentos, minúsculas, con guiones) */
function nameKey(raw) {
  return String(raw || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quita acentos
    .toLowerCase().trim()
    .replace(/\s+/g, '-')         // espacios -> guiones
    .replace(/[^a-z0-9-]/g, '')   // sólo a-z 0-9 -
    || 'anon';
}

/**
 * Agrega a la lista de espera general de forma idempotente por juego y ciegas.
 */
export async function addToWaitingList(name, tableId, gameType = null, smallBlind = null, bigBlind = null, tableName = '', slotNumber = '') {
  const clean = String(name || '').trim();
  if (!clean) throw new Error('Nombre requerido');

  let gt = gameType;
  let sb = smallBlind;
  let bb = bigBlind;

  // Si se llama desde la mesa (solo tiene tableId), buscar sus datos
  if (!gt && tableId) {
    const { getDoc } = await import('firebase/firestore');
    const tableSnap = await getDoc(doc(db, 'tables', tableId));
    if (tableSnap.exists()) {
      const t = tableSnap.data();
      gt = t.gameType || 'NLHE';
      sb = Number(t.smallBlind || 0);
      bb = Number(t.bigBlind || 0);
    }
  }

  if (!gt) gt = 'NLHE';
  if (sb === null) sb = 25;
  if (bb === null) bb = 25;

  const nKey = nameKey(clean);
  // docId estable por nombre, tipo de juego y ciegas
  const id = `w-${nKey}-${gt.toLowerCase()}-${sb}-${bb}`;
  const ref = doc(db, 'generalWaitingList', id);

  await setDoc(ref, {
    name: clean,
    nameLower: clean.toLowerCase(),
    gameType: gt,
    smallBlind: Number(sb),
    bigBlind: Number(bb),
    tableId: tableId || null,
    tableName: tableName || null,
    slotNumber: slotNumber || null,
    createdAt: serverTimestamp(),
  }, { merge: true });

  return id;
}

export async function removeFromWaitingList(docId) {
  const ref = doc(db, 'generalWaitingList', docId);
  await deleteDoc(ref);
}

// Alias para compatibilidad con otros módulos
export const removePlayerFromWaitingList = removeFromWaitingList;

/**
 * Suscripción en tiempo real a toda la lista de espera general ordenada por antigüedad.
 */
export function listenGeneralWaitingList(callback) {
  const q = query(collection(db, 'generalWaitingList'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (qsnap) => {
    const list = [];
    qsnap.forEach((d) => {
      list.push({ id: d.id, ...d.data() });
    });
    callback(list);
  }, (err) => {
    console.error('[listenGeneralWaitingList]', err);
  });
}

/**
 * Suscripción en tiempo real a la lista de espera de un juego específico,
 * ordenada por antigüedad.
 * @param {string} gameId
 * @param {(list: Array<{id: string}>) => void} callback
 * @returns {() => void} Función para cancelar la suscripción.
 */
export function subscribeWaitingListByGame(gameId, callback) {
  if (!gameId) {
    return () => {};
  }
  const q = query(
    collection(db, 'waitingList'),
    where('gameId', '==', gameId),
    orderBy('createdAt', 'asc'),
  );
  return onSnapshot(q, (qsnap) => {
    const list = [];
    qsnap.forEach((d) => {
      list.push({ id: d.id, ...d.data() });
    });
    callback(list);
  }, (err) => {
    console.error('[subscribeWaitingListByGame]', err);
  });
}

export async function addToWaitingListByGame(gameId, { name, playerId } = {}) {
  if (!gameId) throw new Error('gameId is required');
  const payload = { gameId, createdAt: serverTimestamp() };
  if (name) payload.playerName = name;
  if (playerId) payload.playerId = playerId;
  const docRef = await addDoc(collection(db, 'waitingList'), payload);
  return docRef.id;
}

export async function removeFromWaitingListByGame(docId) {
  if (!docId) throw new Error('docId is required');
  await deleteDoc(doc(db, 'waitingList', docId));
}

