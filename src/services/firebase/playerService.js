// src/services/firebase/playerService.js

import { doc, getDoc, updateDoc, deleteDoc, increment } from "firebase/firestore";
import { db } from "../config/firebaseConfig.js";
import { getTableId } from "../../utils/getTableId.js";

export async function addChipsToPlayer(seatId, amount) {
  const tableId = getTableId();
  const seatRef = doc(db, "tables", tableId, "seats", seatId);
  const seatSnap = await getDoc(seatRef);

  if (!seatSnap.exists()) {
    throw new Error("El jugador no existe en ese asiento");
  }

  await updateDoc(seatRef, {
    chips: increment(amount),
    buyInCount: increment(1)
  });
}

export async function cashOutPlayer(seatId) {
  const tableId = getTableId();
  const seatRef = doc(db, "tables", tableId, "seats", seatId);
  const seatSnap = await getDoc(seatRef);

  if (!seatSnap.exists()) {
    throw new Error("Jugador no encontrado");
  }

  await deleteDoc(seatRef);
}
