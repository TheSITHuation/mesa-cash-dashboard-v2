// src/services/td3/publisher.js
import { db } from '../config/firebaseConfig.js';
import { setDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';

// ⚠️ Usa SOLO las claves UPPER de TTD3 que quieres guardar
const ALLOW = [
  'Level', 'RoundNum', 'SmallBlind', 'BigBlind', 'Ante',
  'NextSmallBlind', 'NextBigBlind', 'NextAnte',
  'PlayersLeft', 'Buyins', 'TotalRebuys', 'TotalAddons',
  'ChipCount', 'Pot',
  'SecondsLeft', 'SecondsElapsed',
  'IsBreak', 'NextIsBreak', 'NextBreak', 'nextBreak',
  'nextBreakAt', 'addonTimeLeft', 'rebuyTimeLeft',
  'Currency', 'Title', 'StateDesc', 'prizes', 'payouts',
  // Economic tokens
  'TotalBuyinsAmount', 'TotalBuyinsRake', 'TotalBuyinsChips',
  'TotalRebuysAmount', 'TotalRebuysRake', 'TotalRebuysChips',
  'TotalAddonsAmount', 'TotalAddonsRake', 'TotalAddonsChips',
  'DefaultBuyinFee', 'DefaultBuyinRake', 'DefaultBuyinChips',
  'DefaultRebuyFee', 'DefaultRebuyRake', 'DefaultRebuyChips',
  'DefaultAddonFee', 'DefaultAddonRake', 'DefaultAddonChips',
  'GuaranteedPot', 'PreGuaranteedPot', 'HouseAdds',
  'HouseContribution', 'TotalFixedRake', 'FixedRake',
  'RebuysAllowed', 'AddonsAllowed',
];

const pick = (obj, keys) =>
  Object.fromEntries(Object.entries(obj || {}).filter(([k]) => keys.includes(k)));

/**
 * Escribe al doc 'td3/{tournamentId}' con raw "reducido".
 * - Limpia llaves viejas con merge:false
 * - Calcula level y endsAt correctamente
 * @param {Object} rawFromTTD3 - Datos crudos de TD3
 * @param {string} tournamentId - ID del torneo (default: 'currentTournament')
 */
export async function writeTd3ToFirestore (rawFromTTD3 = {}, tournamentId = 'currentTournament') {
  const rawSafe = pick(rawFromTTD3, ALLOW);

  // ── Cálculo de nivel correcto ─────────────────────────────────────────────
  // TD3 envía RoundNum en base-1 (es el nivel que muestra en pantalla).
  // NO sumamos +1. Si viene Level explícito, ese tiene prioridad.
  // Durante un break (IsBreak=1) no actualizamos el nivel (lo dejamos null
  // para que el cliente preserve el último valor mostrado).
  const isBreakNow = Number(rawSafe.IsBreak) === 1;
  let levelFinal = 0;
  const rawLevel    = Number(rawSafe.Level    ?? 0);
  const rawRoundNum = Number(rawSafe.RoundNum ?? 0);
  if (Number.isFinite(rawRoundNum) && rawRoundNum > 0) {
    levelFinal = rawRoundNum;    // RoundNum avanza correctamente
  } else if (Number.isFinite(rawLevel) && rawLevel > 0) {
    levelFinal = rawLevel;       // fallback a Level si no hay RoundNum
  }

  // endsAt: solo si no es break y hay tiempo restante
  let endsAt = null;
  const sec = Number(rawSafe.SecondsLeft || 0);
  if (Number.isFinite(sec) && sec > 0 && !isBreakNow) {
    endsAt = new Date(Date.now() + sec * 1000);
  }

  await setDoc(doc(db, 'td3', tournamentId), {
    raw: rawSafe,
    level: isBreakNow ? null : (levelFinal || null),
    isBreak: isBreakNow ? 1 : 0,
    eventName: rawSafe.Title ?? null,
    currency: rawSafe.Currency ?? 'MXN',
    receivedAt: serverTimestamp(),
    endsAt: endsAt ?? null,
    tournamentId,
  }, { merge: false });
}

/** Borra el torneo y su estructura directamente en Firestore */
export async function resetTd3Doc (tournamentId = 'currentTournament') {
  await deleteDoc(doc(db, 'td3', tournamentId));
  await deleteDoc(doc(db, 'td3', `structure_${tournamentId}`)).catch(() => {});
}
