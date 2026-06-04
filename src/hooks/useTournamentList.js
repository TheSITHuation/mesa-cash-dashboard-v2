// src/hooks/useTournamentList.js
import { useEffect, useState } from 'react';
import { db } from '../services/config/firebaseConfig.js';
import { collection, onSnapshot } from 'firebase/firestore';

/**
 * Lista todos los documentos de torneos activos en td3/
 * Excluye documentos que empiezan con "structure_"
 */
export default function useTournamentList() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!db) {
      setError(new Error('Firestore no inicializado'));
      setLoading(false);
      return () => {};
    }

    const ref = collection(db, 'td3');
    const unsub = onSnapshot(ref, (snap) => {
      const list = [];
      snap.forEach((doc) => {
        const id = doc.id;
        // Excluir documentos de estructura
        if (id.startsWith('structure_')) return;
        
        const data = doc.data();
        // Solo incluir si tiene datos de torneo (raw o level)
        if (data.raw || data.level || data.isBreak) {
          list.push({
            id,
            name: data.tournamentName || data.eventName || id,
            level: data.level,
            isBreak: data.isBreak,
            receivedAt: data.receivedAt,
            ...data,
          });
        }
      });
      setTournaments(list);
      setLoading(false);
    }, (err) => {
      console.error('[useTournamentList] error:', err);
      setError(err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return { tournaments, loading, error };
}
