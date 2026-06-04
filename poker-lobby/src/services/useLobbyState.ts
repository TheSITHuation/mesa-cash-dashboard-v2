// src/services/useLobbyState.ts
import { useEffect, useMemo, useState } from "react";
import { db } from "./firebase";
import { doc, onSnapshot } from "firebase/firestore";

export type LobbyState = {
  eventName?: string;
  tournamentName?: string;
  level?: number;
  smallBlind?: number; bigBlind?: number; ante?: number;
  entries?: number; rebuys?: number; playersRemaining?: number;
  avgStack?: number; clockSeconds?: number;
  nextSmallBlind?: number; nextBigBlind?: number; nextAnte?: number;
  lastUpdated?: number;
  addons?: number; pot?: number; chipCount?: number; stack?: number;
  NextbreakText?: string; nextBreakSeconds?: number;
  countdownSeconds?: number; countdownText?: string;
};

const DEMO: LobbyState = {
  eventName: "Skampa Poker Room • Demo",
  level: 3,
  smallBlind: 200, bigBlind: 400, ante: 400,
  entries: 25, rebuys: 6, playersRemaining: 21,
  avgStack: 23500,
  clockSeconds: 14*60 + 25,
  nextSmallBlind: 300, nextBigBlind: 600, nextAnte: 600,
  addons: 3, pot: 12800, chipCount: 587000, stack: 23500,
  NextbreakText: "20:00", nextBreakSeconds: 20*60
};

function mmssToSec(t?: string) {
  if (!t) return undefined;
  const m = /^\s*(\d+):(\d{2})\s*$/.exec(String(t));
  if (!m) return undefined;
  return Number(m[1]) * 60 + Number(m[2]);
}
const asNum = (v: any) => (v === undefined || v === null || v === "" ? undefined : Number(v));

export function useLobbyState() {
  const [state, setState] = useState<LobbyState>(DEMO);
  const path = (import.meta as any).env?.VITE_LOBBY_DOC || "td3/currentTournament";

  useEffect(() => {
    let unsub = () => {};
    try {
      const d = doc(db, path);
      unsub = onSnapshot(d, (snap) => {
        if (!snap.exists()) return;
        const raw = snap.data() as any;
        const mapped: Partial<LobbyState> = {
          eventName: raw?.eventName ?? raw?.eventname ?? raw?.event_title,
          tournamentName: raw?.tournamentName || raw?.eventName || raw?.eventname,
          level: raw?.round ?? raw?.level,
          smallBlind: raw?.sb ?? raw?.smallBlind,
          bigBlind: raw?.bb ?? raw?.bigBlind,
          ante: raw?.ante,
          nextSmallBlind: raw?.nextSb ?? raw?.nextSmallBlind,
          nextBigBlind: raw?.nextBb ?? raw?.nextBigBlind,
          nextAnte: raw?.nextAnte,
          entries: raw?.entries,
          rebuys: raw?.rebuys ?? raw?.Rebuy,
          playersRemaining: raw?.players ?? raw?.playersRemaining,
          avgStack: raw?.avgStack ?? raw?.stack,
          clockSeconds: raw?.seconds ?? mmssToSec(raw?.clockText),
          countdownSeconds: asNum(raw?.countdown) ?? asNum(raw?.countdownSeconds),
          countdownText: raw?.countdownText,
          lastUpdated: raw?.receivedAtMs,
          addons: asNum(raw?.addons ?? raw?.addOns),
          pot: asNum(raw?.pot),
          chipCount: asNum(raw?.chipCount) ?? asNum(raw?.chips),
          stack: asNum(raw?.stack),
          NextbreakText: raw?.Nextbreak,
          nextBreakSeconds: asNum(raw?.nextBreakSec ?? raw?.nextBreakSeconds) ?? mmssToSec(raw?.Nextbreak),
        };
        setState((prev) => ({ ...prev, ...mapped }) as LobbyState);
      });
    } catch (e) {
      console.warn("Firebase not configured / using DEMO:", e);
    }
    return () => unsub();
  }, [path]);

  useEffect(() => {
    const id = setInterval(() => {
      setState((s) => ({ ...s, clockSeconds: Math.max(0, (s.clockSeconds || 0) - 1) }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const fmt = useMemo(() => ({
    chips(n?: number){ if(n==null) return "–"; return Number(n).toLocaleString("es-MX"); },
    time(sec?: number){
      if(sec==null) return "–:–";
      const h = Math.floor((sec||0)/3600);
      const m = Math.floor(((sec||0)%3600)/60).toString().padStart(2,"0");
      const s = Math.floor((sec||0)%60).toString().padStart(2,"0");
      return h>0 ? `${h}:${m}:${s}` : `${m}:${s}`;
    }
  }), []);

  return { state, setState, fmt };
}
