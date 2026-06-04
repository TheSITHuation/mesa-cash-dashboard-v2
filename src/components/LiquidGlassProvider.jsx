// src/components/LiquidGlassProvider.jsx
import { useEffect } from 'react';

/** Lee variables CSS del :root con fallback numérico */
function cssNum(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function ensureGlassFilter () {
  if (document.getElementById('glass-distortion')) return;

  const baseX  = cssNum('--glass-base-freq-x', 0.014);
  const baseY  = cssNum('--glass-base-freq-y', 0.014);
  const oct    = cssNum('--glass-octaves', 3);
  const blur   = cssNum('--glass-blur', 2.8);
  const scale  = cssNum('--glass-scale', 120);

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('id', 'liquid-glass-scope');
  svg.setAttribute('xmlns', svgNS);
  svg.setAttribute('style', 'position:absolute;width:0;height:0;pointer-events:none');

  const defs = document.createElementNS(svgNS, 'defs');
  const filter = document.createElementNS(svgNS, 'filter');
  filter.setAttribute('id', 'glass-distortion');
  filter.setAttribute('x', '0%');
  filter.setAttribute('y', '0%');
  filter.setAttribute('width', '100%');
  filter.setAttribute('height', '100%');

  const feTur = document.createElementNS(svgNS, 'feTurbulence');
  feTur.setAttribute('type', 'fractalNoise');
  feTur.setAttribute('baseFrequency', `${baseX} ${baseY}`);
  feTur.setAttribute('numOctaves', String(oct));
  feTur.setAttribute('seed', '92');
  feTur.setAttribute('result', 'noise');

  // animación suave (ondas)
  const anim = document.createElementNS(svgNS, 'animate');
  anim.setAttribute('attributeName', 'baseFrequency');
  anim.setAttribute('dur', '12s');
  anim.setAttribute('repeatCount', 'indefinite');
  const aX = (baseX * 0.85).toFixed(4), bX = (baseX * 1.15).toFixed(4);
  const aY = (baseY * 0.85).toFixed(4), bY = (baseY * 1.15).toFixed(4);
  anim.setAttribute('values', `${aX} ${aY}; ${bX} ${bY}; ${aX} ${aY}`);
  feTur.appendChild(anim);

  const feBlur = document.createElementNS(svgNS, 'feGaussianBlur');
  feBlur.setAttribute('in', 'noise');
  feBlur.setAttribute('stdDeviation', String(blur));
  feBlur.setAttribute('result', 'blurred');

  const feMap = document.createElementNS(svgNS, 'feDisplacementMap');
  feMap.setAttribute('in', 'SourceGraphic');
  feMap.setAttribute('in2', 'blurred');
  feMap.setAttribute('scale', String(scale));
  feMap.setAttribute('xChannelSelector', 'R');
  feMap.setAttribute('yChannelSelector', 'G');

  filter.appendChild(feTur);
  filter.appendChild(feBlur);
  filter.appendChild(feMap);
  defs.appendChild(filter);
  svg.appendChild(defs);
  document.body.appendChild(svg);
}

export default function LiquidGlassProvider({ children }) {
  useEffect(() => { ensureGlassFilter(); }, []);
  return children;
}
