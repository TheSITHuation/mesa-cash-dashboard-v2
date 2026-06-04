// src/hooks/useAnimations.js
import { useCallback } from 'react';
import { useMemo } from 'react';

export const springPreset = {
  gentle:   { type: 'spring', stiffness: 200, damping: 22 },
  snappy:  { type: 'spring', stiffness: 400, damping: 30 },
  bouncy:  { type: 'spring', stiffness: 300, damping: 18 },
  smooth:   { type: 'spring', stiffness: 180, damping: 28 },
  quick:    { type: 'spring', stiffness: 450, damping: 35 },
};

export const easePreset = {
  smooth:   [0.4, 0, 0.2, 1],
  snappy:   [0.6, 0, 0.4, 1],
  bounce:   [0.34, 1.56, 0.64, 1],
  out:      [0, 0, 0.2, 1],
};

export function useAnimationConfig() {
  const spring = useMemo(() => springPreset, []);
  const ease = useMemo(() => easePreset, []);

  const getSpring = useCallback((preset = 'snappy') => {
    return springPreset[preset] || springPreset.snappy;
  }, []);

  const getEase = useCallback((preset = 'smooth') => {
    return easePreset[preset] || easePreset.smooth;
  }, []);

  return { spring, ease, getSpring, getEase };
}

export function useStaggerAnimation(count, baseDelay = 0.05) {
  return useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: {
          type: 'spring',
          stiffness: 300,
          damping: 26,
          delay: i * baseDelay,
        },
      })),
    [count, baseDelay]
  );
}

export function useTabAnimation() {
  const tabVariants = {
    enter: (direction) => ({
      x: direction > 0 ? 40 : -40,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 320,
        damping: 30,
      },
    },
    exit: (direction) => ({
      x: direction > 0 ? -40 : 40,
      opacity: 0,
      transition: { duration: 0.18, ease: 'easeIn' },
    }),
  };

  const indicatorVariants = {
    initial: { width: 0 },
    animate: (width) => ({
      width,
      transition: { type: 'spring', stiffness: 400, damping: 35 },
    }),
  };

  return { tabVariants, indicatorVariants };
}

export function useDeleteAnimation() {
  const deleteVariants = {
    initial: { scale: 1, opacity: 1, filter: 'blur(0px)' },
    animating: {
      scale: [1, 0.92, 0.88],
      x: [0, -6, 6, -4, 4, 0],
      filter: ['blur(0px)', 'blur(2px)', 'blur(6px)'],
    },
    exit: {
      scale: 0.7,
      opacity: 0,
      y: -20,
      transition: { duration: 0.35, ease: [0.4, 0, 0.2, 1] },
    },
  };

  const triggerDelete = useCallback((onComplete) => {
    return {
      scale: 1,
      opacity: 1,
      filter: 'blur(0px)',
      transition: { duration: 0 },
    };
  }, []);

  return { deleteVariants, triggerDelete };
}
