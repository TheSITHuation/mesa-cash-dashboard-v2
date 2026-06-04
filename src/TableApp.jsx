import { useState, useEffect } from 'react';
import SeatModal from './components/seat-modal/SeatModal.jsx';
import { db } from './services/config/firebaseConfig.js';
import { collection, onSnapshot } from 'firebase/firestore';
import { getTableId } from './utils/getTableId.js';
import usePromotions from './hooks/usePromotions.js';
import { PromoBanner } from './components/promo-banner/PromoBanner.jsx';

export default function TableApp() {
  const [seatModal, setSeatModal] = useState({
    open: false, seatId: null, seatInfo: {}, playerFromWaiting: null, maxSeats: 9,
  });
  const [occupiedSeats, setOccupiedSeats] = useState([]);
  const { promotions } = usePromotions();

  // Escuchar asientos ocupados en tiempo real
  useEffect(() => {
    const tableId = getTableId();
    if (!tableId) return;
    const ref = collection(db, 'tables', tableId, 'seats');
    const unsub = onSnapshot(ref, (snap) => {
      const occupied = [];
      snap.forEach(doc => {
        const d = doc.data();
        const st = String(d?.status || 'empty').toLowerCase();
        const isOcc = st === 'occupied'
          || !!(d?.name || d?.playerName || d?.player?.name)
          || Number(d?.chips ?? d?.player?.chips ?? 0) > 0;
        if (isOcc) occupied.push(doc.id);
      });
      setOccupiedSeats(occupied);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const onOpenSeat = (e) => setSeatModal({
      open: true,
      seatId: e.detail.seatId,
      seatInfo: e.detail.seatInfo || {},
      playerFromWaiting: e.detail.playerFromWaiting || null,
      maxSeats: e.detail.maxSeats || 9,
    });

    const onOpenPlayerCard = (e) => {
      const { seatId, seatInfo } = e.detail || {};
      import('./components/player-card/player-card.js').then(({ openPlayerCard }) => {
        openPlayerCard(seatId, seatInfo);
      });
    };

    window.addEventListener('open-seat-modal', onOpenSeat);
    window.addEventListener('open-player-card', onOpenPlayerCard);
    return () => {
      window.removeEventListener('open-seat-modal', onOpenSeat);
      window.removeEventListener('open-player-card', onOpenPlayerCard);
    };
  }, []);

  return (
    <>
      <SeatModal
        isOpen={seatModal.open}
        onClose={() => setSeatModal(prev => ({ ...prev, open: false }))}
        seatId={seatModal.seatId}
        seatInfo={seatModal.seatInfo}
        playerFromWaiting={seatModal.playerFromWaiting}
        occupiedSeats={occupiedSeats}
        maxSeats={seatModal.maxSeats}
      />
      {/* Banner de promociones fijado en la parte inferior de la mesa */}
      {(() => {
        const isLobby = 
          /[?&#](lobby=1)\b/i.test(window.location.href) ||
          /[?&#](view=lobby)\b/i.test(window.location.href) ||
          window.location.hash.toLowerCase().includes('lobby') ||
          window.location.pathname.toLowerCase().includes('lobby');
        
        // El Gestor de Mesas no tiene parámetro 'table'
        const isManager = !new URLSearchParams(window.location.search).get('table') && !isLobby;

        if (isLobby || isManager) return null;
        if (!promotions || promotions.length === 0) return null;

        return (
          <div style={{
            position: 'fixed',
            bottom: '140px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '92%',
            maxWidth: '800px',
            zIndex: 9000,
            pointerEvents: 'none'
          }}>
            <PromoBanner promotions={promotions} />
          </div>
        );
      })()}
    </>
  );
}