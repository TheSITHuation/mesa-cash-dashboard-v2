// src/services/firebase/seatService.js
// CRUD sobre tables/{tableId}/seats
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebaseConfig.js';
import { getTableId } from '../../utils/getTableId.js';

// helpers
function requireTableId(id) {
  const tid = id || getTableId();
  if (!tid) throw new Error('[seatService] tableId indefinido');
  return tid;
}
function requireSeatId(seatId) {
  if (!seatId) throw new Error('[seatService] seatId indefinido');
  return seatId;
}
function seatRef(tableId, seatId) {
  return doc(db, 'tables', tableId, 'seats', seatId);
}
function inferSeatNumber(seatId) {
  const n = parseInt(String(seatId).split('_')[1], 10);
  return Number.isFinite(n) ? n : null;
}

// API
export async function sitPlayer(tableId, seatId, player) {
  const tid = requireTableId(tableId);
  const sid = requireSeatId(seatId);
  const now = Date.now();

  const name = String(player?.name || '').trim();
  const chips = Number(player?.chips ?? 0);
  const avatarUrl = String(player?.avatarUrl || player?.avatar || '') || '/avatars/default.png';

  await setDoc(
    seatRef(tid, sid),
    {
      seatNumber: inferSeatNumber(sid),
      status: 'occupied',

      name,
      playerName: name,
      chips,
      avatarUrl,

      player: { id: player?.id ?? null, name, chips, avatar: avatarUrl },

      playTime: { totalMs: 0, lastTick: now },

      buyIns: Number(player?.buyIns ?? 1),
      movements: Array.isArray(player?.movements) ? player.movements : [],
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function occupySeat(tableId, seatId, data) {
  return sitPlayer(tableId, seatId, data);
}

export async function freeSeat(tableId, seatId, { resetTime = false } = {}) {
  const tid = requireTableId(tableId);
  const sid = requireSeatId(seatId);

  const patch = {
    status: 'empty',                 // ← unificamos como 'empty'
    name: '',
    playerName: '',
    chips: 0,
    avatarUrl: '',
    player: null,
    updatedAt: serverTimestamp(),
  };

  if (resetTime) {
    patch.playTime = { totalMs: 0, lastTick: Date.now() }; // ← (bug fix) era 'ppatch'
  }

  await updateDoc(seatRef(tid, sid), patch);
}

export async function clearSeat(tableId, seatId) {
  const tid = requireTableId(tableId);
  const sid = requireSeatId(seatId);
  await deleteDoc(seatRef(tid, sid));
}

export async function assignPlayerToSeat(seatId, playerData) {
  const tid = requireTableId();
  return sitPlayer(tid, seatId, playerData);
}
export async function clearSeatCurrent(seatId) {
  const tid = requireTableId();
  return clearSeat(tid, seatId);
}
