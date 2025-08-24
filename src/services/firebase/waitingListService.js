// src/services/firebase/waitingListService.js
import { db } from '../config/firebaseConfig.js';
import {
  collection,
  addDoc,
  doc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { getTableId } from '../../utils/getTableId.js';

export async function addToWaitingList(name, tableIdOverride) {
  const tableId = tableIdOverride || getTableId();
  const col = collection(db, 'tables', tableId, 'waitingList');
  const ref = await addDoc(col, {
    name: String(name || '').trim(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function removePlayerFromWaitingList(playerDocId, tableIdOverride) {
  const tableId = tableIdOverride || getTableId();
  const ref = doc(db, 'tables', tableId, 'waitingList', playerDocId);
  await deleteDoc(ref);
}

export function listenToWaitingList(callback, tableIdOverride) {
  const tableId = tableIdOverride || getTableId();
  const col = collection(db, 'tables', tableId, 'waitingList');
  const q = query(col, orderBy('createdAt', 'asc'));
  return onSnapshot(q, (qs) => {
    const players = [];
    qs.forEach((d) => {
      const data = d.data();
      players.push({ id: d.id, name: data?.name || '—' });
    });
    callback(players);
  });
}
