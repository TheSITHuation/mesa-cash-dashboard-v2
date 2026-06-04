// src/services/firebase/tablesService.js
import { db } from '../config/firebaseConfig.js';
import {
  collection, query, orderBy, startAfter, limit, getDocs,
  addDoc, deleteDoc, doc, serverTimestamp, where, updateDoc
} from 'firebase/firestore';

/**
 * Lista mesas con paginación y búsqueda opcional por nombre.
 * @param {Object} opts
 * @param {number} opts.pageSize
 * @param {string} opts.search
 * @param {object|null} opts.cursor  // doc snapshot para startAfter
 * @returns {Promise<{items: Array, nextCursor: any}>}
 */
export async function listenTables({ pageSize = 10, search = '', cursor = null } = {}) {
  const col = collection(db, 'tables');

  // Búsqueda simple por nombre (prefijo). Si no usas índice compuesto, quítala.
  const base = search
    ? query(
        col,
        where('name', '>=', search),
        where('name', '<=', search + '\uf8ff'),
        orderBy('name', 'asc'),
        limit(pageSize)
      )
    : query(
        col,
        orderBy('createdAt', 'desc'),
        limit(pageSize)
      );

  const q = cursor ? query(base, startAfter(cursor)) : base;
  const snap = await getDocs(q);

  const items = snap.docs.map(d => ({ id: d.id, ...d.data(), __doc: d }));
  const nextCursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
  return { items, nextCursor };
}

export async function createTable(payload = {}) {
  const col = collection(db, 'tables');
  const docRef = await addDoc(col, {
    name: payload.name || 'Mesa',
    gameType: payload.gameType || 'NLHE',
    smallBlind: payload.smallBlind ?? 10,
    bigBlind: payload.bigBlind ?? 20,
    buyinMin: payload.buyinMin ?? 1000,
    buyinMax: payload.buyinMax ?? 2000,
    status: payload.status || 'waiting',
    active: payload.active ?? false,
    createdAt: serverTimestamp(),
    // añade más campos si tu app los usa
  });
  return docRef.id;
}

export async function deleteTable(id) {
  await deleteDoc(doc(db, 'tables', id));
}

export async function setActiveTable(id, active = true) {
  await updateDoc(doc(db, 'tables', id), { active });
}
