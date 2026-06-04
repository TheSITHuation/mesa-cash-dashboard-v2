// src/components/seat-modal/SeatModal.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { playerAvatars } from '../../data/playerAvatars.js';
import { sitPlayer } from '../../services/firebase/seatService.js';
import { removePlayerFromWaitingList } from '../../services/firebase/waitingListService.js';
import { getTableId } from '../../utils/getTableId.js';

const backdropVariants = {
  hidden: { opacity: 0, backdropFilter: 'blur(0px)' },
  visible: {
    opacity: 1,
    backdropFilter: 'blur(12px)',
    transition: { duration: 0.25 },
  },
  exit: {
    opacity: 0,
    backdropFilter: 'blur(0px)',
    transition: { duration: 0.2 },
  },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.88, y: 30 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 320,
      damping: 26,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 20,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

const avatarBounceVariants = {
  selected: {
    scale: [1, 1.15, 1],
    transition: { duration: 0.3, times: [0, 0.5, 1] },
  },
};

const successVariants = {
  hidden: { opacity: 0, scale: 0.5 },
  visible: {
    opacity: 1,
    scale: [0.5, 1.1, 1],
    transition: {
      type: 'spring',
      stiffness: 400,
      damping: 20,
    },
  },
};

const formItemVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: (i) => ({
    opacity: 1,
    x: 0,
    transition: {
      delay: 0.15 + i * 0.06,
      type: 'spring',
      stiffness: 280,
      damping: 24,
    },
  }),
};

export default function SeatModal({
  isOpen,
  onClose,
  seatId,
  seatInfo = {},
  playerFromWaiting,
  occupiedSeats = [],
  maxSeats = 9,
}) {
  const [name, setName] = useState('');
  const [buyIn, setBuyIn] = useState('');
  const [selectedSeat, setSelectedSeat] = useState('seat_1');
  const [avatarSearch, setAvatarSearch] = useState('');
  const [avatarPath, setAvatarPath] = useState('');
  const [avatarGridOpen, setAvatarGridOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const overlayRef = useRef(null);
  const wasOpenRef = useRef(false);

  // Initialize modal fields only when it opens
  useEffect(() => {
    if (!isOpen) {
      // Reset any open flag when closed
      wasOpenRef.current = false;
      return;
    }
    // Proceed only once per opening
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    const firstFree = Array.from({ length: maxSeats }, (_, i) => `seat_${i + 1}`).find((id) => !(occupiedSeats || []).includes(id));
    setSelectedSeat(seatId || firstFree || 'seat_1');
    setName(playerFromWaiting?.name || '');
    setBuyIn('');
    setAvatarSearch('');
    setAvatarPath('');
    setError('');
    setShowSuccess(false);
  }, [isOpen]);

  const avatarList = useMemo(() => {
    const q = avatarSearch.trim().toLowerCase();
    if (!q) return playerAvatars;
    return playerAvatars.filter((a) => a.name.toLowerCase().includes(q));
  }, [avatarSearch]);

  const handleAvatarSearch = (e) => {
    const val = e.target.value;
    setAvatarSearch(val);
    const exact = playerAvatars.find(
      (a) => a.name.toLowerCase() === val.trim().toLowerCase()
    );
    if (exact) setAvatarPath(exact.path);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    const tableId = getTableId();
    const chips = Number(buyIn || 0);
    const finalAvatar = avatarPath || '/avatars/default.png';

    if (!tableId) {
      setError('No se detectó mesa activa.');
      return;
    }
    if (!name.trim()) {
      setError('Escribe el nombre del jugador.');
      return;
    }
    if (chips <= 0) {
      setError('Ingresa un buy-in válido.');
      return;
    }

    setLoading(true);
    try {
      await sitPlayer(tableId, selectedSeat, {
        name: name.trim(),
        chips,
        avatarUrl: finalAvatar,
        buyIns: 1,
        movements: [{ type: 'buyin', amount: chips, ts: Date.now() }],
      });

      setShowSuccess(true);

      if (playerFromWaiting?.id) {
        try {
          await removePlayerFromWaitingList(playerFromWaiting.id, tableId);
        } catch (err) {
          console.warn('[SeatModal] No se pudo eliminar de la lista:', err);
        }
      }

      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err) {
      console.error('[SeatModal] Error al sentar:', err);
      setError('Error al conectar. Reintenta.');
    } finally {
      setLoading(false);
    }
  };

  const seats = Array.from({ length: maxSeats }, (_, i) => ({
    id: `seat_${i + 1}`,
    label: `Asiento ${i + 1}`,
    occupied: (occupiedSeats || []).includes(`seat_${i + 1}`),
  }));

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="sm-backdrop"
          ref={overlayRef}
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={(e) => e.target === overlayRef.current && onClose()}
        >
          <motion.div
            className="sm-content"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="sm-header"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h2>Configurar Jugador</h2>
              <motion.button
                type="button"
                className="sm-close"
                onClick={onClose}
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
              >
                ✕
              </motion.button>
            </motion.div>

            <form
              onSubmit={handleSubmit}
              className="sm-form"
            >
              <div className="sm-scroll">
                <motion.div
                  className="form-group-refined"
                  custom={0}
                  variants={formItemVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <label>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v8M8 12h8" />
                    </svg>
                    <span className="sm-form-label-inline">
                      Asiento
                    </span>
                  </label>
                  <div className="seat-pills">
                    {seats.map((s) => {
                      const isSelected = selectedSeat === s.id;
                      const isOccupied = s.occupied;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          className={`seat-pill${isSelected ? ' selected' : ''}${isOccupied ? ' occupied' : ''}`}
                          disabled={isOccupied}
                          onClick={() => !isOccupied && setSelectedSeat(s.id)}
                        >
                          {s.label.replace('Asiento ', '')}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>

                <motion.div
                  className="form-group-refined"
                  custom={1}
                  variants={formItemVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <label>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Nombre Completo
                  </label>
                  <input
                    type="text"
                    className="input-elegant"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre del jugador"
                    autoFocus
                  />
                </motion.div>

                <motion.div
                  className="form-group-refined"
                  custom={2}
                  variants={formItemVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <label>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    Monto de Buy-in
                  </label>
                  <input
                    type="number"
                    className="input-elegant"
                    value={buyIn}
                    onChange={(e) => setBuyIn(e.target.value)}
                    placeholder="$ 0.00"
                  />
                </motion.div>

                <motion.div
                  className="form-group-refined"
                  custom={3}
                  variants={formItemVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <label>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <path d="m16 12-4-4-4 4" />
                    </svg>
                    <span
                      className="sm-avatar-trigger"
                      onClick={() => setAvatarGridOpen(!avatarGridOpen)}
                    >
                      Elección de Avatar
                      <span className={`sm-avatar-chevron ${avatarGridOpen ? 'sm-avatar-chevron--open' : ''}`}>▼</span>
                      {avatarPath && (
                        <span className="sm-avatar-chosen-tag">
                          · {avatarSearch || 'Seleccionado'}
                        </span>
                      )}
                    </span>
                  </label>
                  
                  {/* Collapsible avatar grid */}
                  <div className={`sm-avatar-collapse ${avatarGridOpen ? 'sm-avatar-collapse--open' : ''}`}>
                    <input
                      type="text"
                      className="input-elegant sm-avatar-search"
                      value={avatarSearch}
                      onChange={handleAvatarSearch}
                      placeholder="Filtrar por nombre..."
                    />

                    <div className="sm-avatar-grid-scroll">
                      <div className="avatar-grid-elegant">
                        {avatarList.map((av) => (
                          <motion.button
                            key={av.path}
                            type="button"
                            className={`avatar-item-refined ${
                              avatarPath === av.path ? 'selected' : ''
                            }`}
                            onClick={() => {
                              setAvatarPath(av.path);
                              setAvatarSearch(av.name);
                            }}
                            title={av.name}
                            variants={avatarBounceVariants}
                            animate={avatarPath === av.path ? 'selected' : 'initial'}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <img src={av.path} alt={av.name} />
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      className="sm-error"
                      initial={{ opacity: 0, y: -8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {showSuccess && (
                    <motion.div
                      className="sm-success"
                      variants={successVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      <motion.span
                        className="sm-success-icon"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 0.5, repeat: 1 }}
                      >
                        ✓
                      </motion.span>
                      <span>Jugador sentado</span>
                      <div className="sm-success-particles">
                        {[...Array(8)].map((_, i) => (
                          <motion.span
                            key={i}
                            className="sm-particle"
                            initial={{
                              opacity: 1,
                              x: 0,
                              y: 0,
                            }}
                            animate={{
                              opacity: [1, 0],
                              x: Math.cos((i * 45 * Math.PI) / 180) * 60,
                              y: Math.sin((i * 45 * Math.PI) / 180) * 60,
                            }}
                            transition={{
                              duration: 0.6,
                              delay: i * 0.03,
                              ease: 'easeOut',
                            }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <motion.div
                className="modal-footer-refined"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
              >
                <motion.button
                  type="button"
                  className="btn-elegant btn-elegant-cancel"
                  onClick={onClose}
                  disabled={loading}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Cancelar
                </motion.button>
                <motion.button
                  type="submit"
                  className="btn-elegant btn-elegant-primary"
                  disabled={loading}
                  whileHover={loading ? {} : { scale: 1.03 }}
                  whileTap={loading ? {} : { scale: 0.97 }}
                >
                  {loading ? (
                    <motion.span
                      className="sm-spinner"
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                    >
                      ⟳
                    </motion.span>
                  ) : (
                    'Sentar Jugador'
                  )}
                </motion.button>
              </motion.div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
