import React, { useEffect, useRef, useState } from "react";
import NumberFlow from "@number-flow/react";

function formatTime(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return { h: 0, m: 0, s: 0 };
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return { h, m, s };
}

const nfPanelStyle = {
  fontFamily: "'SF Pro Display', system-ui, -apple-system, sans-serif !important",
  fontWeight: "800 !important",
  fontSize: "inherit !important",
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "0px",
};

export default function TimerDisplay({ totalSeconds = 0, paused = false, compact = false }) {
  const [display, setDisplay] = useState(formatTime(totalSeconds));
  const prevRef = useRef(totalSeconds);

  useEffect(() => {
    if (prevRef.current !== totalSeconds) {
      prevRef.current = totalSeconds;
      setDisplay(formatTime(totalSeconds));
    }
  }, [totalSeconds]);

  const { h, m, s } = display;
  const showHours = h > 0 || compact === false;

  if (compact) {
    return (
      <span className="timer-flow-compact" style={{ opacity: paused ? 0.5 : 1, transition: "opacity 0.3s", fontFamily: "inherit", fontWeight: "inherit", fontSize: "inherit" }}>
        {showHours && (
          <>
            <NumberFlow value={h} format={{ minimumIntegerDigits: 2 }} style={{ fontFamily: "inherit", fontWeight: "inherit", fontSize: "inherit" }} />
            <span className="timer-sep"> : </span>
          </>
        )}
        <NumberFlow value={m} format={{ minimumIntegerDigits: 2 }} style={{ fontFamily: "inherit", fontWeight: "inherit", fontSize: "inherit" }} />
        <span className="timer-sep"> : </span>
        <NumberFlow value={s} format={{ minimumIntegerDigits: 2 }} style={{ fontFamily: "inherit", fontWeight: "inherit", fontSize: "inherit" }} />
      </span>
    );
  }

  return (
    <div className="timer-flow" style={{ opacity: paused ? 0.5 : 1, transition: "opacity 0.3s" }}>
      {showHours && (
        <>
          <NumberFlow value={h} format={{ minimumIntegerDigits: 2 }} style={nfPanelStyle} />
          <span className="timer-sep">:</span>
        </>
      )}
      <NumberFlow value={m} format={{ minimumIntegerDigits: 2 }} style={nfPanelStyle} />
      <span className="timer-sep">:</span>
      <NumberFlow value={s} format={{ minimumIntegerDigits: 2 }} style={nfPanelStyle} />
    </div>
  );
}
