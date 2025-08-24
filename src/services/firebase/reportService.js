// src/services/firebase/reportService.js

import { doc, getDoc, collection, getDocs } from "firebase/firestore"; 
import { db } from "../config/firebaseConfig.js";
import { getTableId } from "../../utils/getTableId.js";

export async function getTableReportData() {
  const tableId = getTableId();
  const tableRef = doc(db, "tables", tableId);
  const seatsRef = collection(db, "tables", tableId, "seats");

  const [tableSnap, seatsSnap] = await Promise.all([
    getDoc(tableRef),
    getDocs(seatsRef)
  ]);

  if (!tableSnap.exists()) return "";

  const tableData = tableSnap.data();
  const seatsData = [];
  seatsSnap.forEach((doc) => {
    seatsData.push({ seatId: doc.id, ...doc.data() });
  });

  // --- Crear contenido CSV ---
  let csv = `Mesa: ${tableId}\nEstado: ${tableData.status}\n\n`;
  csv += "Asiento,Jugador,Buy-in,Avatar\n";

  seatsData.forEach((seat) => {
    csv += `${seat.seatId},${seat.name || ""},${seat.buyIn || 0},${seat.avatarUrl || ""}\n`;
  });

  return csv;
}
