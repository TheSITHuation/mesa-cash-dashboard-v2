// src/services/firebase/tableSlotsService.js
import { db } from '../config/firebaseConfig.js';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';

const META_DOC = 'meta/tableSlots';
const MAX_SLOTS = 25;
const SLOT_PREFIX = 'Table-';

/**
 * Obtiene el estado actual de los slots consultando las mesas existentes.
 */
export async function getTableSlots() {
  const ref = doc(db, META_DOC);
  const snap = await getDoc(ref);
  
  let meta = snap.exists() ? snap.data() : { maxSlots: MAX_SLOTS, prefix: SLOT_PREFIX };
  const maxSlots = meta.maxSlots || MAX_SLOTS;
  const prefix = meta.prefix || SLOT_PREFIX;

  // Consultar las mesas existentes para saber qué slots están en uso
  const tablesSnap = await getDocs(collection(db, 'tables'));
  const usedSlots = [];
  tablesSnap.forEach(d => {
    const id = d.id;
    if (id.startsWith(prefix)) {
      usedSlots.push(id);
    }
  });

  const allSlots = Array.from({ length: maxSlots }, (_, i) => `${prefix}${i + 1}`);

  // Guardar meta actualizado
  if (!snap.exists()) {
    await setDoc(ref, {
      maxSlots,
      prefix,
      usedSlots,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(ref, {
      usedSlots,
      updatedAt: serverTimestamp(),
    });
  }

  return {
    maxSlots,
    prefix,
    usedSlots,
    availableSlots: allSlots.filter(s => !usedSlots.includes(s)),
  };
}

/**
 * Reserva un slot y retorna el ID de la mesa.
 * Si se pasa un slotId específico, intenta reservar ese.
 * Si no, reserva el primer slot disponible.
 * Retorna: { tableId: 'Table-1', slotNumber: 1 }
 */
export async function reserveNextSlot(slotId = null) {
  const ref = doc(db, META_DOC);
  const snap = await getDoc(ref);
  
  let data = snap.exists() ? snap.data() : { maxSlots: MAX_SLOTS, prefix: SLOT_PREFIX, usedSlots: [] };
  if (!data.usedSlots) data.usedSlots = [];

  const allSlots = Array.from({ length: data.maxSlots }, (_, i) => `${data.prefix}${i + 1}`);
  const prefix = data.prefix || SLOT_PREFIX;

  let chosenSlot = null;

  if (slotId) {
    // Intentar reservar el slot específico
    if (data.usedSlots.includes(slotId)) {
      throw new Error(`El slot ${slotId} ya está en uso.`);
    }
    if (!allSlots.includes(slotId)) {
      throw new Error(`El slot ${slotId} no es válido.`);
    }
    chosenSlot = slotId;
  } else {
    // Reservar el primer slot disponible
    chosenSlot = allSlots.find(s => !data.usedSlots.includes(s));
    if (!chosenSlot) {
      throw new Error(`No hay slots disponibles. Máximo ${data.maxSlots} mesas.`);
    }
  }

  // Reservar el slot
  const usedSlots = [...data.usedSlots, chosenSlot];
  await updateDoc(ref, {
    usedSlots,
    updatedAt: serverTimestamp(),
  });

  return {
    tableId: chosenSlot,
    slotNumber: parseInt(chosenSlot.replace(prefix, ''), 10),
  };
}

/**
 * Libera un slot cuando se elimina una mesa.
 */
export async function releaseSlot(tableId) {
  const ref = doc(db, META_DOC);
  const snap = await getDoc(ref);
  
  if (!snap.exists()) return;

  const data = snap.data();
  const usedSlots = (data.usedSlots || []).filter(s => s !== tableId);

  await updateDoc(ref, {
    usedSlots,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Verifica si un slot está disponible.
 */
export async function isSlotAvailable(tableId) {
  const slots = await getTableSlots();
  return slots.availableSlots.includes(tableId);
}

/**
 * Obtiene información de un slot específico.
 */
export function getSlotInfo(tableId) {
  const prefix = SLOT_PREFIX;
  if (!tableId.startsWith(prefix)) return null;
  
  const number = parseInt(tableId.replace(prefix, ''), 10);
  return {
    tableId,
    slotNumber: number,
    displayName: `Mesa ${number}`,
    url: `?table=${tableId}`,
  };
}
