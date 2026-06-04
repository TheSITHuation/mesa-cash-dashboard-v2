// src/hooks/useTd3.js
import { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../services/config/firebaseConfig.js';
import { doc, onSnapshot } from 'firebase/firestore';

const STALE_MS = 2 * 60 * 1000; // ajusta a 5*60*1000 si tu feed a veces “salta”

const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const firstDef = (...vals) => {
  for (const v of vals) if (v !== undefined && v !== null) return v;
  return undefined;
};
const firstPos = (...vals) => {
  for (const v of vals) {
    const x = Number(v);
    if (Number.isFinite(x) && x > 0) return x;
  }
  return 0;
};
const firstNum = (...vals) => {
  for (const v of vals) {
    if (v === null || v === undefined) continue;
    const x = Number(v);
    if (Number.isFinite(x)) return x;
  }
  return null;
};

// acepta "MM:SS", "H:MM:SS" o número puro de segundos
const mmssToSeconds = (txt) => {
  if (typeof txt === 'number') return txt;
  if (!txt || typeof txt !== 'string') return 0;
  const hms = txt.trim().split(':').map((s) => Number(s));
  if (hms.some((x) => !Number.isFinite(x))) return 0;
  if (hms.length === 2) {
    const [m, s] = hms;
    return m * 60 + s;
  }
  if (hms.length === 3) {
    const [h, m, s] = hms;
    return h * 3600 + m * 60 + s;
  }
  return 0;
};

function normalizeTd3(s = {}) {
  const r = s.raw || {};
  const hasRaw = r && Object.keys(r).length > 0;

  const isBreak     = num(firstDef(s.isBreak,     hasRaw ? r.IsBreak     : s.IsBreak,     0)) === 1;
  const nextIsBreak = num(firstDef(s.nextIsBreak, hasRaw ? r.NextIsBreak : s.NextIsBreak, 0)) === 1;

  // ── Cálculo de nivel ─────────────────────────────────────────────────────
  // Fuente de verdad preferida: s.level (campo calculado que guarda el publisher
  // o la Cloud Function con la lógica correcta, sin +1 y respetando breaks).
  // Fallback solo si s.level es null/0: usar r.RoundNum o r.Level del raw.
  //
  // ⚠️ Durante un break (isBreak=1): s.level ya viene como null desde el
  // publisher, y r.RoundNum puede estar apuntando al nivel del break (inflado).
  // Usamos s.level previo si está disponible, o 0 si no hay nada.
  let round = 0;
  // 1) Prioridad máxima: s.level (campo calculado correcto)
  const sLevel = num(firstDef(s.level), 0);
  if (sLevel > 0) {
    round = sLevel;
  } else if (!isBreak) {
    // 2) Solo si NO es break: intentar raw
    if (hasRaw) {
      const rLevel    = num(firstDef(r.Level),    0);
      const rRoundNum = num(firstDef(r.RoundNum), 0);
      // TD3 a veces congela 'Level' en 1, pero 'RoundNum' siempre avanza.
      // Por eso usamos rRoundNum primero.
      round = rRoundNum > 0 ? rRoundNum : rLevel;
    } else {
      // s.round es legacy 0-based (Cloud Function antigua), sí suma +1
      const R = num(firstDef(s.round), -1);
      round = R >= 0 ? R + 1 : 0;
    }
  }
  // Si isBreak=true y sLevel=0: round queda en 0 (el Lobby mostrará "BREAK")

  const sb   = hasRaw ? num(r.SmallBlind, 0) : num(s.smallBlind, 0);
  const bb   = hasRaw ? num(r.BigBlind,   0) : num(s.bigBlind,   0);
  const ante = hasRaw ? num(r.Ante,       0) : num(s.ante,       0);

  const nextSb   = hasRaw ? num(r.NextSmallBlind, 0) : num(s.nextSmallBlind, 0);
  const nextBb   = hasRaw ? num(r.NextBigBlind,   0) : num(s.nextBigBlind,   0);
  const nextAnte = hasRaw ? num(r.NextAnte,       0) : num(s.nextAnte,       0);

  const players = hasRaw ? num(firstDef(r.PlayersLeft), 0)
                         : num(firstDef(s.playersRemaining, s.players), 0);
  const entries = hasRaw ? num(firstDef(r.Buyins, r.Entrants), 0) : num(s.entrants, 0);
  const rebuys  = hasRaw ? num(firstDef(r.TotalRebuys), 0)       : num(s.rebuys, 0);
  const addons  = hasRaw ? num(firstDef(r.TotalAddons), 0)       : num(s.addons, 0);
  const chips   = hasRaw ? num(firstDef(r.ChipCount, r.UnadjustedChipCount), 0) : num(s.chipCount, 0);
  const pot     = hasRaw ? num(firstDef(r.Pot, r.GuaranteedPot), 0) : num(s.pot, 0);

  const buyin   = num(s.buyin, 0);

  let secForClock = hasRaw ? num(r.SecondsLeft, 0) : firstPos(s.levelSecondsRemaining, s.seconds);
  const clockText = firstDef(s.clock, hasRaw ? firstDef(r.Clock, r.ClockText) : undefined, s.clockText);
  if (secForClock === 0 && clockText) {
    const parsed = mmssToSeconds(clockText);
    if (parsed > 0) secForClock = parsed;
  }

  const elapsedSec = num(firstDef(hasRaw ? r.SecondsElapsed : s.elapsedSeconds), 0);

  const receivedAtMs = (s.receivedAt && typeof s.receivedAt.toMillis === 'function')
    ? s.receivedAt.toMillis() : null;
  const endsAtMs = (s.endsAt && typeof s.endsAt.toMillis === 'function')
    ? s.endsAt.toMillis() : null;

  const avgStack = players > 0 ? Math.round(chips / players) : 0;

  const stateDescRaw = String(firstDef(s.state, hasRaw ? r.StateDesc : undefined, '') || '');
  const stateDesc = stateDescRaw.toLowerCase();
  const pausedFlag = num(firstDef(s.paused, hasRaw ? firstDef(r.Paused, r.IsPaused, r.OnHold, r.Hold, r.ClockPaused) : undefined, 0));
  const isPaused = (
    pausedFlag === 1 ||
    ['paused', 'pause', 'hold', 'onhold', 'stopped'].includes(stateDesc)
  );

  const preStart = !isBreak && round <= 1 && elapsedSec === 0 && (secForClock > 0 || (clockText && mmssToSeconds(clockText) > 0));

  const rebuysAllowed = hasRaw ? firstDef(r.RebuysAllowed, r.AllowRebuys, true) : firstDef(s.rebuysAllowed, true);
  const addonsAllowed = hasRaw ? firstDef(r.AddonsAllowed, r.AllowAddons, true) : firstDef(s.addonsAllowed, true);

  const addonTimeLeftStr = s.addonTimeLeft || (hasRaw ? firstDef(r.addonTimeLeft, r.AddonTimeLeft, r.addonTime, r.AddonTime) : undefined);
  let addonSecondsLeftBase = (addonTimeLeftStr && typeof addonTimeLeftStr === 'string' && addonTimeLeftStr.includes(':')) 
    ? mmssToSeconds(addonTimeLeftStr) 
    : null;

  // Si no es un string MM:SS, buscamos el número directo de segundos (lo que manda tu JSON)
  if (addonSecondsLeftBase === null) {
    addonSecondsLeftBase = hasRaw 
      ? firstNum(r.AddonsSecondsLeft, r.addonsSecondsLeft, null) 
      : firstNum(s.addonsSecondsLeft, s.AddonsSecondsLeft, null);
  }

  // ── Next Break Countdown (prioridad: estructura CSV > TD3 raw > fallback) ──
  // 1) secondsUntilBreak: calculado por Cloud Function usando la estructura CSV
  const structSecondsUntilBreak = num(firstDef(s.secondsUntilBreak), 0);

  // 2) nextBreak string MM:SS (TD3 raw)
  const nextBreakStr = s.nextbreak || s.nextBreak || (hasRaw ? firstDef(r.NextBreak, r.nextBreak, r.Nextbreak) : '') || '';
  let nextBreakSecondsLeftBase = (nextBreakStr !== undefined && nextBreakStr !== null && nextBreakStr !== '') ? mmssToSeconds(nextBreakStr) : null;

  // 3) Números explícitos de "BreakSeconds"
  if (nextBreakSecondsLeftBase === null) {
    nextBreakSecondsLeftBase = hasRaw
      ? firstNum(r.NextBreakSeconds, r.NextBreakSecondsLeft, r.nextBreakSeconds, r.nextBreakSecondsLeft, null)
      : firstNum(s.nextBreakSeconds, s.nextBreakSecondsLeft, s.NextBreakSeconds, s.NextBreakSecondsLeft, s.nextbreakSeconds, null);
  }

  // 4) Fallback: si no hay dato pero nextIsBreak=true, usar tiempo del nivel actual
  if (nextBreakSecondsLeftBase === null && nextIsBreak) {
    nextBreakSecondsLeftBase = secForClock;
  }

  // Si la estructura CSV dio un valor válido, usarlo como prioridad
  if (structSecondsUntilBreak > 0) {
    nextBreakSecondsLeftBase = structSecondsUntilBreak;
  }

  return {
    tournamentName: firstDef(s.eventName, hasRaw ? firstDef(r.EventName, r.Title) : s.tournamentName, 'Torneo'),
    currency: firstDef(s.currency, hasRaw ? r.Currency : undefined, 'MXN'),
    round, sb, bb, ante,
    nextSb, nextBb, nextAnte,
    players, entries, rebuys, addons, chips, pot, buyin, avgStack,
    seconds: secForClock, clockText, elapsedSec,
    isBreak, nextIsBreak, preStart,
    receivedAtMs, endsAtMs,
    _stateDesc: stateDesc, isPaused,
    rebuysAllowed: rebuysAllowed !== false && rebuysAllowed !== 'false' && rebuysAllowed !== 0,
    addonsAllowed: addonsAllowed !== false && addonsAllowed !== 'false' && addonsAllowed !== 0,
    addonSecondsLeftBase,
    nextBreakSecondsLeftBase
  };
}

function computeSecondsLeft({ seconds, receivedAtMs, endsAtMs, isPaused }) {
  if (isPaused) return Math.max(0, Math.floor(Number(seconds) || 0));
  const now = Date.now();
  if (endsAtMs) return Math.max(0, Math.round((endsAtMs - now) / 1000));
  if (receivedAtMs && seconds > 0) return Math.max(0, Math.round((receivedAtMs + seconds * 1000 - now) / 1000));
  return Math.max(0, Math.floor(seconds || 0));
}

function computeAddonSecondsLeft({ addonSecondsLeftBase, receivedAtMs, isPaused }) {
  if (addonSecondsLeftBase === null || addonSecondsLeftBase === undefined) return null;
  if (isPaused) return Math.max(0, Math.floor(Number(addonSecondsLeftBase) || 0));
  const now = Date.now();
  if (receivedAtMs && addonSecondsLeftBase > 0) return Math.max(0, Math.round((receivedAtMs + addonSecondsLeftBase * 1000 - now) / 1000));
  return Math.max(0, Math.floor(addonSecondsLeftBase || 0));
}

function computeNextBreakSecondsLeft({ nextBreakSecondsLeftBase, receivedAtMs, isPaused }) {
  if (nextBreakSecondsLeftBase === null || nextBreakSecondsLeftBase === undefined) return null;
  if (isPaused) return Math.max(0, Math.floor(Number(nextBreakSecondsLeftBase) || 0));
  const now = Date.now();
  if (receivedAtMs && nextBreakSecondsLeftBase > 0) return Math.max(0, Math.round((receivedAtMs + nextBreakSecondsLeftBase * 1000 - now) / 1000));
  return Math.max(0, Math.floor(nextBreakSecondsLeftBase || 0));
}

export default function useTd3(tournamentId = 'currentTournament') {
  const [raw, setRaw] = useState(null);
  const [error, setError] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [addonSecondsLeft, setAddonSecondsLeft] = useState(null);
  const [nextBreakSecondsLeft, setNextBreakSecondsLeft] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!db) {
      setError(new Error('Firestore no inicializado'));
      return () => {};
    }
    const ref = doc(db, 'td3', tournamentId);
    const off = onSnapshot(
      ref,
      { includeMetadataChanges: false },
      (snap) => {
        setRaw(snap.exists() ? (snap.data() || null) : null);
        setError(null);
      },
      (err) => setError(err)
    );
    return () => off();
  }, [tournamentId]);

  const n = useMemo(() => (raw ? normalizeTd3(raw) : null), [raw]);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (!n) { 
      setSecondsLeft(0); 
      setAddonSecondsLeft(null);
      setNextBreakSecondsLeft(null);
      return; 
    }

    // staleness
    const stale = n.receivedAtMs ? (Date.now() - n.receivedAtMs) > STALE_MS : false;
    if (stale) { 
      setSecondsLeft(0); 
      setAddonSecondsLeft(null);
      setNextBreakSecondsLeft(null);
      return; 
    }

    const tick = () => {
      setSecondsLeft(computeSecondsLeft(n));
      setAddonSecondsLeft(computeAddonSecondsLeft(n));
      setNextBreakSecondsLeft(computeNextBreakSecondsLeft(n));
    };

    tick();
    if (!n.isPaused) timerRef.current = setInterval(tick, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [n]);

  const show = useMemo(() => {
    if (!n) return false;
    const stale = n.receivedAtMs ? (Date.now() - n.receivedAtMs) > STALE_MS : false;
    const inProgressStates = new Set(['inprogress', 'running', 'live']);
    const inProgress = inProgressStates.has(n._stateDesc);
    // Mostrar también durante breaks (isBreak=true) aunque round sea 0
    return !stale && (inProgress || n.preStart || n.round > 0 || n.isBreak);
  }, [n]);

  const result = { data: n, secondsLeft, addonSecondsLeft, nextBreakSecondsLeft, nextIsBreak: n?.nextIsBreak, show, error };
  if (import.meta.env.DEV && typeof window !== 'undefined') window.debugTd3 = result;
  return result;
}
