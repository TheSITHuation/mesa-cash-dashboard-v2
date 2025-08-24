// src/services/firebase/playTimeService.js
import { db } from '../config/firebaseConfig.js';
import {
  doc, getDoc, collection, getDocs, writeBatch, serverTimestamp
} from 'firebase/firestore';
import { getTableId } from '../../utils/getTableId.js';
import { updateTable } from './tableService.js';

export async function pauseAllSeatTimers(tableIdParam = null) {
  const tableId = tableIdParam || getTableId();
  if (!tableId) return;

  const now = Date.now();
  const seatsRef = collection(db, 'tables', tableId, 'seats');
  const qs = await getDocs(seatsRef);
  const batch = writeBatch(db);

  qs.forEach((d) => {
    const s = d.data();
    if (s?.status !== 'occupied') return;
    batch.update(d.ref, {
      playTime: { totalMs: Number(s?.playTime?.totalMs || 0), lastTick: now, paused: true },
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
  // marca mesa en pausa
  try { await updateTable(tableId, { status: 'en espera', active: false }); } catch {}
}

export async function resumeAllSeatTimers(tableIdParam = null) {
  const tableId = tableIdParam || getTableId();
  if (!tableId) return;

  const now = Date.now();
  const seatsRef = collection(db, 'tables', tableId, 'seats');
  const qs = await getDocs(seatsRef);
  const batch = writeBatch(db);

  qs.forEach((d) => {
    const s = d.data();
    if (s?.status !== 'occupied') return;
    batch.update(d.ref, {
      playTime: { totalMs: Number(s?.playTime?.totalMs || 0), lastTick: now, paused: false },
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
  // marca mesa activa
  try { await updateTable(tableId, { status: 'activa', active: true }); } catch {}
}

// --- Config ---
const TICK_MS = 10_000; // cada 10s. Puedes bajar a 5_000 si quieres más granularidad

let _intervalId = null;
let _runningForTable = null;

function isTableActive(status) {
  const s = String(status || '').toLowerCase();
  return s === 'active' || s === 'activa';
}


async function _applyTick(tableId) {
  const tableRef = doc(db, 'tables', tableId);
  const tableSnap = await getDoc(tableRef);
  if (!tableSnap.exists()) return;

  const table = tableSnap.data();
  if (!isTableActive(table?.status)) return; // pausa si no está activa

  const seatsRef = collection(db, 'tables', tableId, 'seats');
  const seatsSnap = await getDocs(seatsRef);
  if (seatsSnap.empty) return;

  const now = Date.now();
  const batch = writeBatch(db);

  seatsSnap.forEach((seatDoc) => {
    const seat = seatDoc.data();
    if (seat?.status !== 'occupied') return;
    if (seat?.playTime?.paused) return;

    const pt = seat.playTime || {};
    const last  = typeof pt.lastTick === 'number' ? pt.lastTick : now;
    const delta = Math.max(0, now - last);
    const base  = Number(pt.totalMs || 0);

    if (delta === 0 && pt.totalMs != null) return;

    batch.update(seatDoc.ref, {
      playTime: { totalMs: base + delta, lastTick: now },
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

export function startPlayTimeTicker(passedTableId = null) {
  const tableId = passedTableId || getTableId();
  if (!tableId) return;

  if (_intervalId && _runningForTable === tableId) return;

  if (_intervalId && _runningForTable && _runningForTable !== tableId) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
  _runningForTable = tableId;

  _applyTick(tableId).catch(console.error);
  _intervalId = setInterval(() => _applyTick(tableId).catch(console.error), TICK_MS);
}

export function stopPlayTimeTicker() {
  if (_intervalId) clearInterval(_intervalId);
  _intervalId = null;
  _runningForTable = null;
}

export function isPlayTimeTickerRunning() {
  return Boolean(_intervalId);
}

export async function resetSeatPlayTime(seatId, passedTableId = null) {
  const tableId = passedTableId || getTableId();
  if (!tableId || !seatId) return;

  const seatRef = doc(db, 'tables', tableId, 'seats', seatId);
  const now = Date.now();

  await writeBatch(db).update(seatRef, {
    playTime: { totalMs: 0, lastTick: now },
    updatedAt: serverTimestamp(),
  }).commit();
}

export async function manualTick(passedTableId = null) {
  const tableId = passedTableId || getTableId();
  if (!tableId) return;
  await _applyTick(tableId);
}