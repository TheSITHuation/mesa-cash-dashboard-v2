import { useEffect, useRef } from "react";

/**
 * Inyecta <filter id="lg-distort" /> y sincroniza sus parámetros
 * con las CSS variables definidas en :root (index.css).
 */
export default function FluidGlassDefs({ id = "lg-distort" }: { id?: string }) {
  const feTurRef = useRef<SVGFETurbulenceElement | null>(null);
  const feBlurRef = useRef<SVGFEGaussianBlurElement | null>(null);
  const feDispRef = useRef<SVGFEDisplacementMapElement | null>(null);

  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    const num = (name: string, def: number) => {
      const v = css.getPropertyValue(name).trim();
      const n = Number(v);
      return Number.isFinite(n) ? n : def;
    };
    const apply = () => {
      if (feTurRef.current) feTurRef.current.setAttribute("baseFrequency", String(num("--lg-turbulence", 0.02)));
      if (feDispRef.current) feDispRef.current.setAttribute("scale", String(num("--lg-scale", 160)));
      if (feBlurRef.current) feBlurRef.current.setAttribute("stdDeviation", String(num("--lg-blur", 2.4)));
    };
    apply();
    const i = setInterval(apply, 5000);
    return () => clearInterval(i);
  }, []);

  return (
    <svg width="0" height="0" style={{ position: "fixed" }} aria-hidden>
      <defs>
<filter id="drop-distort">
  <feTurbulence type="fractalNoise" baseFrequency="0.012 0.018" numOctaves="2" seed="3" result="noise"/>
  <feGaussianBlur in="noise" stdDeviation="0.6" result="n2"/>
  <feDisplacementMap in="SourceGraphic" in2="n2" scale="12" xChannelSelector="R" yChannelSelector="G"/>
</filter>

      </defs>
    </svg>
  );
}
