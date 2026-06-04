// src/components/StartOverlay.jsx
// Avant-garde attraction screen for the player-facing lobby.
// Design philosophy: Emil Kowalski (animations.dev).
//   - Custom easing curves (built-in are too weak)
//   - Apple-style springs for entrance ("duration + bounce")
//   - transform strings for hardware acceleration (not x/y/scale)
//   - Never start from scale(0) — start from scale(0.95) + opacity
//   - Cohesion: 0.5s entrances, 4-12s breathing, all under 300ms for one-shot motion
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import '../components/ui/AnimatedOverlay.css';

const EASE_OUT = [0.23, 1, 0.32, 1];
const EASE_IN_OUT = [0.77, 0, 0.175, 1];
const APPLE_SPRING = { type: 'spring', duration: 0.55, bounce: 0.18 };
const GENTLE_SPRING = { type: 'spring', duration: 0.7, bounce: 0.12 };

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
      initial={{ opacity: 0, transform: 'translateY(20px)' }}
      animate={{ opacity: 1, transform: 'translateY(0)' }}
      transition={{ delay: 1.2, ...APPLE_SPRING }}
    >
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor">
        <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.81 9.81 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.52-3.67 8.19-8.19 8.19-1.55 0-3.07-.43-4.39-1.25l-.31-.19-3.11.82.83-3.03-.21-.33a8.2 8.2 0 0 1-1.26-4.38c0-4.52 3.67-8.19 8.19-8.19h.22zm-3.54 3.03c-.15 0-.39.06-.6.27-.21.21-.81.79-.81 1.92 0 1.13.82 2.22.94 2.37.11.15 1.62 2.47 3.92 3.47.55.24.97.38 1.31.48.55.17 1.05.15 1.44.09.44-.07 1.35-.55 1.54-1.08.19-.53.19-.98.13-1.08-.06-.1-.21-.15-.45-.27-.24-.12-1.44-.71-1.66-.8-.22-.08-.38-.12-.55.12-.17.24-.65.81-.8 1-.15.17-.3.19-.55.07-.24-.12-1.02-.37-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.01-.38.11-.5.11-.11.24-.28.37-.42.12-.15.17-.25.25-.42.08-.17.04-.32-.02-.45-.06-.12-.55-1.33-.76-1.82-.2-.48-.41-.42-.6-.42z" />
      </svg>
      <span>Información</span>
    </motion.a>
  );
};

// 3 asymmetric ripple rings expanding from the card center.
// Asymmetric timing reads as organic, not robotic.
const rippleVariants = {
  animate: {
    transform: ['scale(1)', 'scale(2.4)'],
    opacity: [0.5, 0],
    borderWidth: ['1.5px', '0px'],
    transition: { duration: 2.8, repeat: Infinity, ease: EASE_OUT },
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
          animate={{ opacity: 1, transition: { duration: 0.4, ease: EASE_OUT } }}
          exit={{ opacity: 0, transition: { duration: 0.35, ease: EASE_OUT } }}
        >
          {/* Layer 1 — Multi-gradient breathing stage (3 colors in counterpoint) */}
          <div className="so-stage" aria-hidden="true">
            <div className="so-stage-glow" />
            <div className="so-grain" />
          </div>

          {/* Layer 2 — Expanding ripples (asymmetric, organic) */}
          <motion.div className="so-ripples" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="so-ripple-ring"
                variants={rippleVariants}
                animate="animate"
                transition={{ delay: i * 0.55, duration: 2.8 + i * 0.3 }}
              />
            ))}
          </motion.div>

          {/* Layer 3 — The card (3D entrance, never from scale 0) */}
          <motion.div
            className="so-card-premium"
            initial={{ opacity: 0, transform: 'translateY(20px) scale(0.95)' }}
            animate={{ opacity: 1, transform: 'translateY(0) scale(1)' }}
            exit={{ opacity: 0, transform: 'translateY(-20px) scale(0.95)', transition: { duration: 0.35, ease: EASE_OUT } }}
            transition={APPLE_SPRING}
          >
            <div className="so-card-content">
              {/* Logo: 3 halo rings (staggered) + logo image + soft glow */}
              <div className="so-halo-stack" aria-hidden="true">
                <div className="so-halo so-halo--1" />
                <div className="so-halo so-halo--2" />
                <div className="so-halo so-halo--3" />
              </div>

              <motion.div
                className="so-logo-container"
                initial={{ opacity: 0, transform: 'scale(0.88) rotateY(-8deg)' }}
                animate={{ opacity: 1, transform: 'scale(1) rotateY(0deg)' }}
                transition={{ delay: 0.1, ...APPLE_SPRING }}
              >
                <motion.img
                  className="so-logo-premium"
                  src="/branding/logo.png"
                  alt="Casino Logo"
                  whileHover={{ transform: 'scale(1.05) rotateY(4deg)' }}
                  transition={{ type: 'spring', duration: 0.4, bounce: 0.25 }}
                />
                <div className="so-logo-glow" />
              </motion.div>

              <motion.h2
                className="so-title-premium"
                initial={{ opacity: 0, transform: 'translateY(14px)' }}
                animate={{ opacity: 1, transform: 'translateY(0)' }}
                transition={{ delay: 0.5, ...APPLE_SPRING }}
              >
                Bienvenido a <span className="so-brand-name">Experience Poker</span>
              </motion.h2>

              <motion.div
                className="so-separator"
                initial={{ transform: 'scaleX(0)', opacity: 0 }}
                animate={{ transform: 'scaleX(1)', opacity: 0.5 }}
                transition={{ delay: 0.6, duration: 0.5, ease: EASE_OUT }}
              />

              <motion.p
                className="so-sub-premium"
                initial={{ opacity: 0, transform: 'translateY(10px)' }}
                animate={{ opacity: 1, transform: 'translateY(0)' }}
                transition={{ delay: 0.7, ...APPLE_SPRING }}
              >
                Pronto comenzaremos. Mantente atento
              </motion.p>

              <motion.div
                className="so-loading-bar"
                initial={{ opacity: 0, transform: 'scaleX(0.4)' }}
                animate={{ opacity: 1, transform: 'scaleX(1)' }}
                transition={{ delay: 0.9, duration: 0.5, ease: EASE_OUT }}
              >
                <div className="so-loading-fill" />
              </motion.div>

              <motion.div
                className="so-status-row"
                initial={{ opacity: 0, transform: 'translateY(6px)' }}
                animate={{ opacity: 1, transform: 'translateY(0)' }}
                transition={{ delay: 1.05, ...GENTLE_SPRING }}
                aria-hidden="true"
              >
                <span>Próximamente</span>
                <div className="so-status-dot" />
                <div className="so-status-dot" />
                <div className="so-status-dot" />
              </motion.div>
            </div>
          </motion.div>

          <WA phone={phone} />
        </motion.section>
      )}
    </AnimatePresence>
  );
}
