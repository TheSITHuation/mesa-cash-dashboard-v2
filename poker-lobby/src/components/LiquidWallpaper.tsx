// src/components/LiquidWallpaper.tsx
export default function LiquidWallpaper(){
  return (
    <>
      {/* SVG filter used by the wallpaper */}
      <svg className="liquid-defs" aria-hidden="true">
        <defs>
          <filter id="liquid-caustics">
            <feTurbulence type="fractalNoise" baseFrequency="0.010 0.016" numOctaves="2" seed="7" result="fbm"/>
            <feGaussianBlur in="fbm" stdDeviation="0.6" result="s"/>
            <feDisplacementMap in="SourceGraphic" in2="s" scale="12" xChannelSelector="R" yChannelSelector="G"/>
          </filter>
        </defs>
      </svg>
      {/* Background animated layer */}
      <div className="liquid-wallpaper" />
    </>
  );
}
