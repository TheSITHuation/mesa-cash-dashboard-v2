// src/lib/ensureGlassFilter.js
export function ensureGlassFilter(){
  if (document.getElementById('glass-distortion')) return;
  const v = (name, def) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || def;
  const toNum = (x, d) => (Number(x) || d);
  const baseX = toNum(v('--glass-base-freq-x','0.014'), 0.014);
  const baseY = toNum(v('--glass-base-freq-y','0.014'), 0.014);
  const oct   = toNum(v('--glass-octaves','3'), 3);
  const blur  = toNum(v('--glass-blur-noise','2.8'), 2.8);
  const scale = toNum(v('--glass-scale','120'), 120);

  const svgNS='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(svgNS,'svg');
  svg.setAttribute('xmlns', svgNS);
  svg.setAttribute('style','position:absolute;width:0;height:0;pointer-events:none');
  const defs=document.createElementNS(svgNS,'defs');
  const filter=document.createElementNS(svgNS,'filter');
  filter.setAttribute('id','glass-distortion'); filter.setAttribute('x','0%'); filter.setAttribute('y','0%');
  filter.setAttribute('width','100%'); filter.setAttribute('height','100%');

  const feTur=document.createElementNS(svgNS,'feTurbulence');
  feTur.setAttribute('type','fractalNoise');
  feTur.setAttribute('baseFrequency',`${baseX} ${baseY}`);
  feTur.setAttribute('numOctaves',String(oct));
  feTur.setAttribute('seed','92');
  feTur.setAttribute('result','noise');

  const anim=document.createElementNS(svgNS,'animate');
  const aX=(baseX*0.85).toFixed(4), bX=(baseX*1.15).toFixed(4);
  const aY=(baseY*0.85).toFixed(4), bY=(baseY*1.15).toFixed(4);
  anim.setAttribute('attributeName','baseFrequency');
  anim.setAttribute('dur','12s'); anim.setAttribute('repeatCount','indefinite');
  anim.setAttribute('values',`${aX} ${aY}; ${bX} ${bY}; ${aX} ${aY}`);
  feTur.appendChild(anim);

  const feBlur=document.createElementNS(svgNS,'feGaussianBlur');
  feBlur.setAttribute('in','noise'); feBlur.setAttribute('stdDeviation',String(blur));
  feBlur.setAttribute('result','blurred');

  const feMap=document.createElementNS(svgNS,'feDisplacementMap');
  feMap.setAttribute('in','SourceGraphic'); feMap.setAttribute('in2','blurred');
  feMap.setAttribute('scale',String(scale));
  feMap.setAttribute('xChannelSelector','R'); feMap.setAttribute('yChannelSelector','G');

  filter.appendChild(feTur); filter.appendChild(feBlur); filter.appendChild(feMap);
  defs.appendChild(filter); svg.appendChild(defs);
  document.body.appendChild(svg);
}
