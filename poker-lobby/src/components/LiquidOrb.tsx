// src/components/LiquidOrb.tsx
import { Canvas } from '@react-three/fiber';
import { Environment, Float, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { useMemo } from 'react';

export default function LiquidOrb({
  size = 520,
  progress = 0, // 0–1
  children,
}: {
  size?: number;
  progress?: number;
  children?: React.ReactNode;
}) {
  const ringColor = '#d9b66f';

  // Geometría del arco de progreso (pastel digital)
  const Arc = ({ frac }: { frac: number }) => {
    const inner = 2.25, outer = 2.45;
    const segs = 128;
    const start = Math.PI * 1.5;        // arriba
    const len = Math.max(0.001, Math.min(1, frac)) * Math.PI * 2; // 0..2π
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        {/* arco de fondo completo gris tenue */}
        <ringGeometry args={[inner, outer, segs, 1, 0, Math.PI * 2]} />
        <meshBasicMaterial color="rgba(255,255,255,0.18)" transparent />
        {/* arco activo dorado */}
        <mesh rotation={[0, 0, start]}>
          <ringGeometry args={[inner, outer, segs, 1, 0, len]} />
          <meshBasicMaterial color={ringColor} transparent opacity={0.95} />
        </mesh>
      </mesh>
    );
  };

  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true }}
        camera={{ position: [0, 0, 6], fov: 40 }}
        shadows={false}
      >
        <ambientLight intensity={0.65} />
        <directionalLight position={[5, 5, 5]} intensity={0.6} />

        {/* Orbe vítreo “mojado” */}
        <Float speed={1.2} rotationIntensity={0.25} floatIntensity={0.6}>
          <mesh>
            <sphereGeometry args={[1.9, 64, 64]} />
            <MeshTransmissionMaterial
              thickness={0.5}
              roughness={0.15}
              transmission={1}
              ior={1.3}
              chromaticAberration={0.03}
              anisotropy={0.1}
            />
          </mesh>
        </Float>

        {/* Anillo de progreso */}
        <group scale={1.0}>
          <Arc frac={progress} />
        </group>

        <Environment preset="night" />
      </Canvas>

      {/* Slot para overlay (tu reloj/labels en DOM) */}
      {children ? <div style={{ position: 'absolute', inset: 0 }}>{children}</div> : null}
    </div>
  );
}
