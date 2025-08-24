// src/services/firebase/getActiveTable.js
import { db } from '../config/firebaseConfig.js';
import { doc, getDoc, collection, query, where, limit, getDocs, orderBy } from 'firebase/firestore';
import { getTableId } from '../../utils/getTableId.js';

export async function getActiveTable() {
  // 1) ¿Viene en la URL?
  const fromUrl = getTableId();
  if (fromUrl) {
    const ref = doc(db, 'tables', fromUrl);
    const snap = await getDoc(ref);
    if (snap.exists()) return { id: snap.id, ...snap.data() };
  }

  // 2) Prioriza el flag booleano 'active' (más robusto)
  const tablesRef = collection(db, 'tables');
  let qActive = query(tablesRef, where('active', '==', true), limit(1));
  let qs = await getDocs(qActive);
  if (!qs.empty) {
    const d = qs.docs[0];
    return { id: d.id, ...d.data() };
  }

  // 3) Fallback por status de texto (soporta 'active' y 'activa')
  try {
    const qStatus = query(tablesRef, where('status', 'in', ['active', 'activa']), limit(1));
    qs = await getDocs(qStatus);
    if (!qs.empty) {
      const d = qs.docs[0];
      return { id: d.id, ...d.data() };
    }
  } catch (_) { /* puede faltar índice 'in'; ignorar */ }

  // 4) Último recurso: la más reciente marcada como activa por fecha (si existiera)
  try {
    const qLatest = query(tablesRef, where('active', '==', true), orderBy('createdAt', 'desc'), limit(1));
    qs = await getDocs(qLatest);
    if (!qs.empty) {
      const d = qs.docs[0];
      return { id: d.id, ...d.data() };
    }
  } catch (_) {}

  return null;
}
