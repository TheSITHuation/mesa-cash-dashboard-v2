// src/services/firebase/pendingArrivalsService.js
import { db } from '../config/firebaseConfig.js';
import { collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, where, serverTimestamp } from 'firebase/firestore';

function ref(tableId) {
  return collection(db, 'tables', tableId, 'pendingArrivals');
}

export async function addPendingArrival(tableId, player) {
  const docRef = await addDoc(ref(tableId), {
    playerName: player.name,
    playerId: player.id,
    gameType: player.gameType || '',
    smallBlind: Number(player.smallBlind || 0),
    bigBlind: Number(player.bigBlind || 0),
    status: 'pending',
    _createdAt: Date.now(),
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function completeArrival(tableId, docId) {
  await updateDoc(doc(db, 'tables', tableId, 'pendingArrivals', docId), {
    status: 'completed',
    completedAt: serverTimestamp(),
  });
}

export async function dismissArrival(tableId, docId) {
  await updateDoc(doc(db, 'tables', tableId, 'pendingArrivals', docId), {
    status: 'dismissed',
    dismissedAt: serverTimestamp(),
  });
}

export async function deleteArrival(tableId, docId) {
  await deleteDoc(doc(db, 'tables', tableId, 'pendingArrivals', docId));
}

export function listenPendingArrivals(tableId, callback) {
  const q = query(ref(tableId), where('status', '==', 'pending'));
  return onSnapshot(q, (snap) => {
    const list = [];
    snap.forEach(d => list.push({ id: d.id, ...d.data() }));
    list.sort((a, b) => (a._createdAt || 0) - (b._createdAt || 0));
    callback(list);
  }, (err) => {
    if (err.code !== 'permission-denied') console.error('[pendingArrivals]', err);
  });
}
