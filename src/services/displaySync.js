// src/services/displaySync.js
import { db } from './config/firebaseConfig.js';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';

export function setDisplayState(tableId, patch) {
  if (!tableId) return Promise.resolve();
  const ref = doc(db, 'tables', tableId, 'display', 'state');
  const data = { ...patch, ts: Date.now() };
  return setDoc(ref, data, { merge: true });
}

export function watchDisplayState(tableId, cb) {
  if (!tableId) return () => {};
  const ref = doc(db, 'tables', tableId, 'display', 'state');
  return onSnapshot(ref, (snap) => {
    const data = snap.exists() ? (snap.data() || {}) : {};
    cb(data);
  });
}
