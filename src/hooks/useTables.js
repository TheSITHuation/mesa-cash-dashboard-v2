// src/hooks/useTables.js
import { useEffect, useRef, useState } from 'react';
import { db } from '../services/config/firebaseConfig.js';
import {
  collection, onSnapshot, orderBy, query, where,
} from 'firebase/firestore';

const moneyMXN = (n) =>
  Number(n || 0).toLocaleString('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0,
  });

const statusLabel = (st) => {
  const v = String(st || '').toLowerCase();
  if (v === 'en-espera') return 'en espera';
  if (v === 'inactive')  return 'inactiva';
  if (v === 'active')    return 'activa';
  return v || 'inactiva';
};

// ——— seats watcher ———
function watchSeats(tableId, onUpdate) {
  try {
    const seatsRef = collection(db, 'tables', tableId, 'seats');
    return onSnapshot(seatsRef, (qsnap) => {
      let occupied = 0;
      const names = [];
      qsnap.forEach((d) => {
        const s = d.data() || {};
        const st = String(s.status || 'empty').toLowerCase();
        const name  = s.player?.name || s.playerName || s.name || '';
        const chips = Number(s.chips ?? s.player?.chips ?? 0);
        const isOcc = st === 'occupied' || !!name || chips > 0;
        if (isOcc) {
          occupied++;
          if (name) names.push(String(name));
        }
      });
      onUpdate({ seatsOccupied: occupied, playerNames: names });
    });
  } catch (e) {
    console.warn('[watchSeats]', tableId, e);
    return () => {};
  }
}

// ——— waiting list watcher ———
function watchWaiting(gameType, smallBlind, bigBlind, onUpdate) {
  try {
    const wlRef = collection(db, 'generalWaitingList');
    const q = query(
      wlRef,
      where('gameType', '==', gameType),
      where('smallBlind', '==', Number(smallBlind)),
      where('bigBlind', '==', Number(bigBlind))
    );
    return onSnapshot(q, (qsnap) => {
      onUpdate({ waitingCount: qsnap.size });
    });
  } catch (e) {
    console.warn('[watchWaiting]', gameType, smallBlind, bigBlind, e);
    return () => {};
  }
}

export default function useTables() {
  const [tables, setTables]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // guardo unsubs por mesa
  const seatUnsubsRef = useRef(new Map());
  const waitUnsubsRef = useRef(new Map());

  useEffect(() => {
    if (!db) {
      setError(new Error('Firestore no inicializado'));
      setLoading(false);
      return () => {};
    }

let qTables = query(
  collection(db, 'tables'),
  where('publicLobby', '==', true),
  orderBy('sortOrder', 'asc'),
);

    const off = onSnapshot(qTables, (snap) => {
      const base = [];
      snap.forEach((d) => base.push({ id: d.id, ...d.data() }));

      // Mapa actual para aplicar parches sin iterar de más
      const map = new Map(
        base.map((t) => [
          t.id,
          {
            ...t,
            seatsOccupied: Number(t.seatsOccupied ?? 0),
            waitingCount:  Number(t.waitingCount ?? 0),
            playerNames:   [],
            statusText:    statusLabel(t.status),
            minBuyFmt:     moneyMXN(t.minBuyIn ?? 0),
            maxBuyFmt:     moneyMXN(t.maxBuyIn ?? 0),
            maxSeats:      Number(t.maxSeats ?? 9) || 9,
            sb:            Number(t.smallBlind ?? 0),
            bb:            Number(t.bigBlind   ?? 0),
            game:          t.gameType || 'NLHE',
          },
        ])
      );

      // limpia listeners de mesas que se fueron
      const currentIds = new Set(map.keys());
      for (const [id, unsub] of seatUnsubsRef.current) {
        if (!currentIds.has(id)) { try { unsub(); } catch {} seatUnsubsRef.current.delete(id); }
      }
      for (const [id, unsub] of waitUnsubsRef.current) {
        if (!currentIds.has(id)) { try { unsub(); } catch {} waitUnsubsRef.current.delete(id); }
      }

      // crea listeners para las mesas nuevas
      for (const id of currentIds) {
        if (!seatUnsubsRef.current.has(id)) {
          const unsub = watchSeats(id, (patch) => {
            setTables((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
          });
          seatUnsubsRef.current.set(id, unsub);
        }
        if (!waitUnsubsRef.current.has(id)) {
          const tData = map.get(id);
          const unsub = watchWaiting(tData.game, tData.sb, tData.bb, (patch) => {
            setTables((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
          });
          waitUnsubsRef.current.set(id, unsub);
        }
      }

      setTables(Array.from(map.values()));
      setLoading(false);
      setError(null);
    }, (err) => {
      setError(err);
      setLoading(false);
    });

    return () => {
      try { off(); } catch {}
      for (const fn of seatUnsubsRef.current.values()) { try { fn(); } catch {} }
      for (const fn of waitUnsubsRef.current.values()) { try { fn(); } catch {} }
      seatUnsubsRef.current.clear();
      waitUnsubsRef.current.clear();
    };
  }, []);

  return { tables, loading, error };
}
