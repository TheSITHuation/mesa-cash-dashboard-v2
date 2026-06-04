// src/components/ui/AnimatedOverlay.jsx
import { motion, AnimatePresence } from 'framer-motion';

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.35, ease: 'easeIn' },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 280,
      damping: 26,
      delay: 0.1,
    },
  },
  exit: {
    opacity: 0,
    y: -30,
    scale: 0.94,
    transition: {
      duration: 0.3,
      ease: 'easeIn',
    },
  },
};

const logoVariants = {
  hidden: { opacity: 0, scale: 0.8, rotate: -3 },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 22,
      delay: 0.2,
    },
  },
};

const glowPulse = {
  animate: {
    opacity: [0.4, 0.9, 0.4],
    scale: [1, 1.08, 1],
    transition: {
      duration: 2.2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

const rippleVariants = {
  animate: {
    scale: [1, 2.2],
    opacity: [0.5, 0],
    transition: {
      duration: 1.4,
      repeat: Infinity,
      ease: 'easeOut',
      delay: 0.4,
    },
  },
};

export function AnimatedOverlayContent({ children }) {
  return (
    <motion.div
      className="aoc-inner"
      variants={overlayVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}

export function AnimatedOverlayCard({ children, exitVariant }) {
  return (
    <motion.div
      className="aoc-card"
      variants={exitVariant ? { ...cardVariants, exit: exitVariant } : cardVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {children}
    </motion.div>
  );
}

export function AnimatedLogo({ children }) {
  return (
    <motion.div
      className="aoc-logo-wrapper"
      variants={logoVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
      <motion.div className="aoc-logo-glow" variants={glowPulse} animate="animate">
        <span className="aoc-glow-ring" />
        <span className="aoc-glow-ring aoc-glow-ring--2" />
      </motion.div>
    </motion.div>
  );
}

export function AnimatedRipple({ color = '#ffd766' }) {
  return (
    <div className="aoc-ripples">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="aoc-ripple"
          style={{ '--ripple-color': color }}
          variants={rippleVariants}
          animate="animate"
          transition={{ delay: i * 0.45 }}
        />
      ))}
    </div>
  );
}
