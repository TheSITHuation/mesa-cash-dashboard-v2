// src/services/firebase/dealerService.js

import { doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebaseConfig.js";
import { getTableId } from "../../utils/getTableId.js";

/**
 * Actualiza el croupier asignado a la mesa.
 * @param {string} dealerName
 * @param {string} avatarUrl
 */
export async function updateDealer(dealerName, avatarUrl) {
  const tableId = getTableId();
  const dealerRef = doc(db, "tables", tableId);
  await updateDoc(dealerRef, {
    dealerName,
    dealerAvatar: avatarUrl,
  });
}

/**
 * Observa los cambios de croupier en tiempo real
 * @param {(dealerData: { dealerName: string, dealerAvatar: string }) => void} callback
 */
export function listenToDealer(callback) {
  const tableId = getTableId();
  const dealerRef = doc(db, "tables", tableId);

  return onSnapshot(dealerRef, (snapshot) => {
    const data = snapshot.data();
    if (!data) return;
    callback({
      dealerName: data.dealerName || "",
      dealerAvatar: data.dealerAvatar || "/avatars/dealer1.png",
    });
  });
}
