// src/hooks/usePromotions.js
import { useEffect, useState } from 'react';
import { listenActivePromotions } from '../services/firebase/promotionService.js';

/**
 * Hook que escucha en tiempo real los anuncios activos desde Firestore.
 * Retorna { promotions, loading }.
 */
export default function usePromotions() {
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub;
    try {
      unsub = listenActivePromotions((docs) => {
        setPromotions(docs);
        setLoading(false);
      });
    } catch (e) {
      console.warn('[usePromotions]', e);
      setLoading(false);
    }
    return () => { try { unsub?.(); } catch {} };
  }, []);

  return { promotions, loading };
}
