// src/hooks/useAuthAnon.js
import { useEffect, useState } from 'react';

/**
 * Garantiza sesión anónima (si no existe) y expone { user, loading, error }.
 * Requiere que inicialices Firebase App antes (p.ej. en main.js).
 */
export default function useAuthAnon({ auto = true } = {}) {
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let off = () => {};
    let cancelled = false;

    (async () => {
      try {
        // Import dinámico para evitar fallos en entornos sin Firebase cargado aún.
        const { getAuth, onAuthStateChanged, signInAnonymously } = await import('firebase/auth');
        const auth = getAuth(); // ← asume que ya inicializaste la app

        off = onAuthStateChanged(auth, (u) => {
          if (cancelled) return;
          setUser(u || null);
          setLoading(false);
        });

        // Si queremos auto-login anónimo y no hay usuario actual:
        if (auto && !auth.currentUser) {
          try {
            await signInAnonymously(auth);
          } catch (e) {
            if (cancelled) return;
            setError(e);
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (e) {
        // getAuth falló porque no hay app, o no está firebase/auth disponible.
        if (!cancelled) {
          setError(e);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      try { off(); } catch {}
    };
  }, [auto]);

  return { user, loading, error };
}
