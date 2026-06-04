// src/components/StartOverlay.jsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../components/ui/AnimatedOverlay.css';

const WA = ({ phone = '+522212038839' }) => {
  const cleanPhone = phone.replace(/[^\d]/g, '');
  const wa = `https://wa.me/${cleanPhone}?text=${encodeURIComponent('Hola, me interesa información de torneos y mesas de cash.')}`;
  return (
    <motion.a
      className="so-wa-premium"
      href={wa}
      target="_blank"
      rel="noopener"
      aria-label="WhatsApp"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, type: 'spring', stiffness: 200, damping: 20 }}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.95 }}
    >
      <motion.div
        className="so-wa-pulse"
        animate={{
          scale: [1, 1.4],
          opacity: [0.6, 0],
        }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
      />
      <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="currentColor">
        <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.81 9.81 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.52-3.67 8.19-8.19 8.19-1.55 0-3.07-.43-4.39-1.25l-.31-.19-3.11.82.83-3.03-.21-.33a8.2 8.2 0 0 1-1.26-4.38c0-4.52 3.67-8.19 8.19-8.19h.22zm-3.54 3.03c-.15 0-.39.06-.6.27-.21.21-.81.79-.81 1.92 0 1.13.82 2.22.94 2.37.11.15 1.62 2.47 3.92 3.47.55.24.97.38 1.31.48.55.17 1.05.15 1.44.09.44-.07 1.35-.55 1.54-1.08.19-.53.19-.98.13-1.08-.06-.1-.21-.15-.45-.27-.24-.12-1.44-.71-1.66-.8-.22-.08-.38-.12-.55.12-.17.24-.65.81-.8 1-.15.17-.3.19-.55.07-.24-.12-1.02-.37-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.01-.38.11-.5.11-.11.24-.28.37-.42.12-.15.17-.25.25-.42.08-.17.04-.32-.02-.45-.06-.12-.55-1.33-.76-1.82-.2-.48-.41-.42-.6-.42z" />
      </svg>
      <span>Información</span>
    </motion.a>
  );
};

const rippleVariants = {
  animate: {
    scale: [1, 2.2],
    opacity: [0.5, 0],
    borderWidth: ['2px', '0px'],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeOut',
      delay: 0.5,
    },
  },
};

const ambientGlowVariants = {
  animate: {
    scale: [1, 1.15, 1],
    opacity: [0.3, 0.5, 0.3],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

const logoContainerVariants = {
  hidden: { opacity: 0, scale: 0.75, rotate: -5 },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: {
      type: 'spring',
      stiffness: 200,
      damping: 20,
      delay: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 50, scale: 0.92 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 24,
      delay: 0.3,
    },
  },
  exit: {
    opacity: 0,
    y: -40,
    scale: 0.9,
    transition: {
      duration: 0.4,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

const titleVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 26,
      delay: 0.5,
    },
  },
};

const subtitleVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 280,
      damping: 28,
      delay: 0.7,
    },
  },
};

const loadingBarVariants = {
  hidden: { scaleX: 0, opacity: 0 },
  visible: {
    scaleX: 1,
    opacity: 1,
    transition: {
      duration: 0.6,
      ease: [0.4, 0, 0.2, 1],
      delay: 0.9,
    },
  },
};

const separatorVariants = {
  hidden: { scaleX: 0 },
  visible: {
    scaleX: 1,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1],
      delay: 0.6,
    },
  },
};

export default function StartOverlay({ show, phone }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.section
          className="so-wrapper-premium"
          aria-hidden={!show}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.35 } }}
        >
          <motion.div
            className="so-ambient-glow"
            variants={ambientGlowVariants}
            animate="animate"
          />

          <motion.div className="so-ripples" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="so-ripple-ring"
                variants={rippleVariants}
                animate="animate"
                transition={{ delay: i * 0.5 }}
              />
            ))}
          </motion.div>

          <motion.div
            className="so-card-premium"
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.div
              className="so-logo-container"
              variants={logoContainerVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.img
                className="so-logo-premium"
                src="/branding/logo.png"
                alt="Casino Logo"
                whileHover={{ scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              />
              <motion.div
                className="so-logo-glow"
                animate={{
                  opacity: [0.4, 0.8, 0.4],
                  scale: [1, 1.1, 1],
                }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </motion.div>

            <motion.h2
              className="so-title-premium"
              variants={titleVariants}
              initial="hidden"
              animate="visible"
            >
              Bienvenido a <span className="so-brand-name">Experience Poker</span>
            </motion.h2>

            <motion.div
              className="so-separator"
              variants={separatorVariants}
              initial="hidden"
              animate="visible"
            />

            <motion.p
              className="so-sub-premium"
              variants={subtitleVariants}
              initial="hidden"
              animate="visible"
            >
              Pronto comenzaremos. Mantente atento
            </motion.p>

            <motion.div
              className="so-loading-bar"
              variants={loadingBarVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div
                className="so-loading-fill"
                animate={{
                  scaleX: [0, 0.7, 1],
                  transition: {
                    duration: 2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  },
                }}
              />
            </motion.div>
          </motion.div>

          <WA phone={phone} />
        </motion.section>
      )}
    </AnimatePresence>
  );
}
