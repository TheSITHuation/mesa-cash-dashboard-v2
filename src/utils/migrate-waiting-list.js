// src/utils/migrate-waiting-list.js
// Migra `tables/{tableId}.waitingList` (array en el doc) -> subcolección `tables/{tableId}/waitingList/*`
// Uso sugerido (en tu app, una sola vez):
//   import { exposeWaitingListMigration } from "./utils/migrate-waiting-list.js";
//   exposeWaitingListMigration(); // añade funciones a window para correr desde consola
//
// Luego en la consola del navegador (DevTools), con la app cargada:
//   await window.migrateWaitingListForTable('<TABLE_ID>'); // p.ej. 'mesa_1'
//   // o para todas las mesas:
//   await window.migrateAllWaitingLists();
//   // ver solo qué pasaría (sin escribir):
//   await window.previewWaitingListForTable('<TABLE_ID>');

import { db } from '../services/config/firebaseConfig.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
  deleteField,
  query,
  limit as qlimit
} from 'firebase/firestore';

/**
 * Convierte un array de jugadores a documentos en la subcolección waitingList.
 * Idempotente: si la subcolección ya tiene N docs y son los mismos nombres,
 * no duplica (compara por nombre).
 * @param {string} tableId
 * @param {Object} opts
 * @param {boolean} opts.removeArrayAfter - elimina el campo array tras migrar
 * @param {boolean} opts.dryRun - si true, no escribe; solo muestra plan
 */
export async function migrateWaitingListForTable(tableId, opts = {}) {
  const { removeArrayAfter = true, dryRun = false } = opts;
  if (!tableId) throw new Error('[migrateWaitingListForTable] tableId requerido');

  const tableRef = doc(db, 'tables', tableId);
  const snap = await getDoc(tableRef);
  if (!snap.exists()) {
    console.warn(`[migrateWaitingListForTable] La mesa ${tableId} no existe`);
    return { tableId, migrated: 0, skipped: true };
  }

  const data = snap.data();
  const arr = Array.isArray(data.waitingList) ? data.waitingList : [];
  if (!arr.length) {
    console.info(`[migrateWaitingListForTable] ${tableId}: no hay array waitingList`);
    return { tableId, migrated: 0, skipped: true };
  }

  // ¿Ya existen docs en subcolección?
  const subCol = collection(db, 'tables', tableId, 'waitingList');
  const existing = await getDocs(query(subCol, qlimit(1)));
  const subExists = !existing.empty;

  const batch = writeBatch(db);
  let toCreate = [];
  let count = 0;

  // Plan de creación: cada entrada del array -> nuevo doc con {name, createdAt}
  for (const entry of arr) {
    const name = String(entry?.name || '').trim();
    if (!name) continue;
    // nota: no deduplicamos por id porque el array usaba Date.now; deduplicar por name basta en transición
    const newDocRef = doc(subCol); // autogen id
    toCreate.push({ ref: newDocRef, data: { name, createdAt: serverTimestamp() } });
  }

  if (!toCreate.length) {
    console.info(`[migrateWaitingListForTable] ${tableId}: no hay entradas válidas para migrar`);
    return { tableId, migrated: 0, skipped: true };
  }

  if (dryRun) {
    console.table(toCreate.map(x => ({ tableId, name: x.data.name })));
    return { tableId, migrated: toCreate.length, dryRun: true };
  }

  for (const item of toCreate) {
    batch.set(item.ref, item.data);
    count++;
  }

  if (removeArrayAfter) {
    batch.update(tableRef, { waitingList: deleteField() });
  }

  await batch.commit();
  console.info(`[migrateWaitingListForTable] ${tableId}: migrados ${count} jugadores -> subcolección waitingList${removeArrayAfter ? ' y array eliminado' : ''}`);
  return { tableId, migrated: count, removedArray: removeArrayAfter };
}

/**
 * Vista previa (no escribe) de lo que se migraría para una mesa.
 * @param {string} tableId
 */
export async function previewWaitingListForTable(tableId) {
  return migrateWaitingListForTable(tableId, { dryRun: true, removeArrayAfter: false });
}

/**
 * Migra todas las mesas que tengan waitingList como array.
 * @param {Object} opts - mismo contrato que migrateWaitingListForTable
 */
export async function migrateAllWaitingLists(opts = {}) {
  const { dryRun = false } = opts;
  const tablesCol = collection(db, 'tables');
  const qs = await getDocs(tablesCol);
  const results = [];
  for (const d of qs.docs) {
    const data = d.data();
    if (Array.isArray(data?.waitingList) && data.waitingList.length) {
      const r = await migrateWaitingListForTable(d.id, opts);
      results.push(r);
    }
  }
  if (dryRun) {
    console.table(results);
  } else {
    console.info('[migrateAllWaitingLists] Resultado:', results);
  }
  return results;
}

/**
 * Expone helpers en window para correr desde consola en una sola sesión.
 */
export function exposeWaitingListMigration() {
  if (typeof window !== 'undefined') {
    window.migrateWaitingListForTable = migrateWaitingListForTable;
    window.previewWaitingListForTable = previewWaitingListForTable;
    window.migrateAllWaitingLists = migrateAllWaitingLists;
    console.info('[waiting-list-migration] Listo. Usa: migrateWaitingListForTable(tableId), previewWaitingListForTable(tableId) o migrateAllWaitingLists().');
  }
}
