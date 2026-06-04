// src/components/ui/ParticleEffect.jsx
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function Particle({ x, y, angle, distance, color, size, delay }) {
  const rad = (angle * Math.PI) / 180;
  const tx = Math.cos(rad) * distance;
  const ty = Math.sin(rad) * distance;

  return (
    <motion.span
      className="particle"
      style={{
        '--particle-x': `${x}px`,
        '--particle-y': `${y}px`,
        '--particle-color': color,
        '--particle-size': `${size}px`,
      }}
      initial={{
        opacity: 1,
        scale: 1,
        x: x,
        y: y,
      }}
      animate={{
        opacity: [1, 0.8, 0],
        scale: [1, 1.4, 0],
        x: x + tx,
        y: y + ty,
      }}
      transition={{
        duration: 0.7,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    />
  );
}

export default function ParticleEffect({
  active,
  count = 8,
  color = '#ffd766',
  originX = 0,
  originY = 0,
  radius = 60,
}) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }

    const generated = Array.from({ length: count }, (_, i) => {
      const angle = (360 / count) * i + (Math.random() * 20 - 10);
      const dist = radius + (Math.random() * 30 - 15);
      const size = 4 + Math.random() * 4;
      const delay = i * 0.03;

      return { id: i, angle, distance: dist, size, delay };
    });

    setParticles(generated);

    const timer = setTimeout(() => setParticles([]), 900);
    return () => clearTimeout(timer);
  }, [active, count, radius]);

  return (
    <AnimatePresence>
      {active && (
        <div
          className="particle-container"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        >
          {particles.map((p) => (
            <Particle
              key={p.id}
              x={originX}
              y={originY}
              angle={p.angle}
              distance={p.distance}
              color={color}
              size={p.size}
              delay={p.delay}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}

export function GoldenBurst({ active, x = 0, y = 0 }) {
  return (
    <ParticleEffect
      active={active}
      count={10}
      color="#ffd766"
      originX={x}
      originY={y}
      radius={50}
    />
  );
}
