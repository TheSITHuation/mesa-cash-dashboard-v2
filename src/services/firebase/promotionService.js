// src/services/firebase/promotionService.js
import { db } from '../config/firebaseConfig.js';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';

const COL = 'promotions';

/** Escucha anuncios activos en tiempo real. */
export function listenActivePromotions(cb) {
  // Quitamos orderBy para evitar necesidad de índices compuestos
  const q = query(
    collection(db, COL),
    where('active', '==', true)
  );
  return onSnapshot(q, (snap) => {
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Ordenamos en memoria: prioridad desc, luego fecha desc
    docs.sort((a, b) => {
      if ((b.priority || 0) !== (a.priority || 0)) {
        return (b.priority || 0) - (a.priority || 0);
      }
      return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
    });
    cb(docs);
  }, (err) => {
    console.error('[listenActivePromotions] Error:', err);
    cb([]);
  });
}

/** Escucha TODOS los anuncios (para el panel de gestión). */
export function listenAllPromotions(cb) {
  const q = query(collection(db, COL), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

/** Crea un anuncio nuevo. */
export async function createPromotion({ title, body, emoji = '📢', priority = 0 }) {
  return addDoc(collection(db, COL), {
    title: String(title || '').trim(),
    body:  String(body  || '').trim(),
    emoji: String(emoji || '📢'),
    priority: Number(priority) || 0,
    active: true,
    createdAt: serverTimestamp(),
  });
}

/** Actualiza un anuncio. */
export async function updatePromotion(id, fields) {
  return updateDoc(doc(db, COL, id), fields);
}

/** Elimina un anuncio. */
export async function deletePromotion(id) {
  return deleteDoc(doc(db, COL, id));
}

/** Activa o desactiva un anuncio. */
export async function togglePromotion(id, active) {
  return updateDoc(doc(db, COL, id), { active: Boolean(active) });
}
