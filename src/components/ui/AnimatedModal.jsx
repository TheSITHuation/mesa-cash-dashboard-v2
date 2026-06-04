// src/components/ui/AnimatedModal.jsx
import { motion, AnimatePresence } from 'framer-motion';

const sizes = {
  sm: { maxWidth: 380 },
  md: { maxWidth: 520 },
  lg: { maxWidth: 720 },
  full: { maxWidth: '95vw', width: '95vw' },
};

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const modalVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 24 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 320,
      damping: 28,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.94,
    y: 16,
    transition: { duration: 0.2, ease: 'easeIn' },
  },
};

export default function AnimatedModal({
  isOpen,
  onClose,
  children,
  size = 'md',
  showClose = true,
  closeOnBackdrop = true,
  className = '',
  style = {},
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className={`animated-modal-root ${className}`} style={style}>
          <motion.div
            className="am-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ duration: 0.22 }}
            onClick={closeOnBackdrop ? onClose : undefined}
            style={{ '--am-blur': '12px' }}
          />

          <motion.div
            className="am-content"
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            style={{ ...sizes[size], '--am-radius': '20px' }}
            role="dialog"
            aria-modal="true"
          >
            {showClose && (
              <button
                className="am-close"
                onClick={onClose}
                aria-label="Cerrar"
                type="button"
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            )}

            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
