// src/services/useCashTables.ts
import { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import type { CashTable } from "../components/CashTableCapsule";

const DEMO: CashTable[] = [
  { id: "demo1", title: "Mesa 1", game: "NLHE", sb: 25, bb: 25, buyinMin: 5000, buyinMax: 5000, players: 6, maxPlayers: 9, waiting: 2, status: "activa" },
  { id: "demo2", title: "Mesa 2", game: "PLO", sb: 50, bb: 100, buyinMin: 5000, buyinMax: 15000, players: 3, maxPlayers: 6, waiting: 0, status: "en espera" },
];

export function useCashTables() {
  const [tables, setTables] = useState<CashTable[]>(DEMO);
  const coll = (import.meta as any).env?.VITE_CASH_TABLES_COLL || "td3/cashTables";

  useEffect(() => {
    try {
      const path = String(coll);
      const parts = path.split("/").filter(Boolean);
      const colRef = parts.length > 1 ? collection(db, parts[0], parts[1]) : collection(db, parts[0]);
      const q = query(colRef, orderBy("title"));
      const unsub = onSnapshot(q, (snap) => {
        const list: CashTable[] = snap.docs.map(d => {
          const r: any = d.data();
          return {
            id: d.id,
            title: r.title || r.name || r.tableName || "Mesa",
            game: (r.game || r.type || "NLHE") as any,
            sb: r.sb ?? r.smallBlind,
            bb: r.bb ?? r.bigBlind,
            buyinMin: r.buyinMin ?? r.min ?? r.buyin?.min,
            buyinMax: r.buyinMax ?? r.max ?? r.buyin?.max,
            players: r.players ?? r.seated ?? r.count,
            maxPlayers: r.maxPlayers ?? r.capacity ?? 9,
            waiting: r.waiting ?? r.waitlist ?? 0,
            status: (r.status || r.state || "en espera") as any,
            whatsapp: r.whatsapp || r.phone,
            playersUrl: r.playersUrl,
          };
        });
        setTables(list);
      });
      return () => unsub();
    } catch (e) {
      console.warn("Firestore no configurado (useCashTables DEMO).", e);
    }
  }, [coll]);

  return tables;
}
