// src/services/firebase/closureService.js
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebaseConfig.js';
import { getGoogleSheetsConfig, getOperatingDate, exportToGoogleSheets } from './googleSheetsService.js';

/* =========================
   HELPERS
   ========================= */

function todayKey() {
  return getOperatingDate(new Date(), 6); // Usar 6 AM por defecto en consultas síncronas
}

function fmt(n, decimals = 2) {
  return Number(n || 0).toFixed(decimals);
}

function computeRakeNeto(totalRake, promotions, rpPct, rpEnabled, abAmount) {
  const rp = rpEnabled ? (totalRake * (rpPct || 0) / 100) : 0;
  return Math.max(0, totalRake - (promotions || 0) - rp - (abAmount || 0));
}

function computeSessionDurationMs(tableData) {
  const state = tableData?.sessionState || 'idle';
  const startAt = tableData?.sessionStartAt;
  const pausedTotalMs = Number(tableData?.pausedTotalMs || 0);
  const pauseStartAt = tableData?.pauseStartedAt;

  let startMs = null;
  if (startAt) {
    if (typeof startAt.toMillis === 'function') startMs = startAt.toMillis();
    else if (typeof startAt === 'number') startMs = startAt;
    else if (startAt.seconds) startMs = startAt.seconds * 1000 + (startAt.nanoseconds || 0) / 1e6;
  }
  if (!startMs) return 0;

  let pauseStartMs = null;
  if (pauseStartAt) {
    if (typeof pauseStartAt.toMillis === 'function') pauseStartMs = pauseStartAt.toMillis();
    else if (typeof pauseStartAt === 'number') pauseStartMs = pauseStartAt;
    else if (pauseStartAt.seconds) pauseStartMs = pauseStartAt.seconds * 1000 + (pauseStartAt.nanoseconds || 0) / 1e6;
  }

  let raw;
  if (state === 'running') raw = Date.now() - startMs - pausedTotalMs;
  else if (state === 'paused') raw = (pauseStartMs || Date.now()) - startMs - pausedTotalMs;
  else return 0;
  return Math.max(0, raw);
}
function getBlindTier(sb, bb) {
  const bigBlind = Number(bb || 0);
  if (bigBlind <= 2) return 'micro';
  if (bigBlind <= 5) return 'low';
  if (bigBlind <= 10) return 'mid';
  return 'high';
}

/* =========================
   CIERRE INDIVIDUAL DE MESA
   ========================= */

export async function closeTable(tableId, closureData) {
  const config = await getGoogleSheetsConfig();
  const today = getOperatingDate(new Date(), config.cutoffHour);

  const tableRef = doc(db, 'tables', tableId);
  const tableSnap = await getDoc(tableRef);
  if (!tableSnap.exists()) throw new Error('Mesa no encontrada');

  const tableData = tableSnap.data();

  // Leer seats
  const seatsRef = collection(db, 'tables', tableId, 'seats');
  const seatsSnap = await getDocs(seatsRef);
  const players = [];
  let occupiedCount = 0;

  seatsSnap.forEach((snap) => {
    const seat = snap.data();
    const isOccupied = seat?.status === 'occupied' || seat?.name || seat?.playerName;
    if (isOccupied) occupiedCount++;
    players.push({
      seatNumber: seat?.seatNumber || 0,
      name: seat?.name || seat?.playerName || '',
      chips: Number(seat?.chips || 0),
      buyIns: Number(seat?.buyIns || 0),
      playTimeMs: Number(seat?.playTime?.totalMs || 0),
    });
  });

  const durationMs = closureData.durationMs || computeSessionDurationMs(tableData);
  const durationHours = durationMs / (1000 * 60 * 60);
  const totalRake = Number(closureData.totalRake || 0);
  const jackpot = Number(closureData.jackpot || 0);
  const promotions = Number(closureData.promotions || 0);
  const rpEnabled = closureData.rpEnabled || false;
  const rpPct = Number(closureData.rpPct || 0);
  const rpName = closureData.rpName || '';
  const tips = Number(closureData.tips || 0);
  const abAmount = Number(closureData.abAmount || 0);

  const rakeNeto = computeRakeNeto(totalRake, promotions, rpPct, rpEnabled, abAmount);
  const totalFichas = totalRake + jackpot + tips;
  const rph = durationHours > 0 ? rakeNeto / durationHours : 0;
  const occupancy = tableData.maxSeats > 0 ? occupiedCount / tableData.maxSeats : 0;
  const rphAdjusted = occupancy > 0 ? rph / occupancy : rph;

  const blindTier = getBlindTier(tableData.smallBlind, tableData.bigBlind);

  const closureDoc = {
    tableId,
    tableName: tableData.name || tableId,
    slotNumber: tableData.slotNumber || 0,
    gameType: tableData.gameType || 'NLHE',
    blinds: {
      sb: Number(tableData.smallBlind || 0),
      bb: Number(tableData.bigBlind || 0),
    },
    dealer: tableData.dealerAvatar || '',
    date: today,
    closedAt: serverTimestamp(),
    sessionStart: tableData.sessionStartAt || null,
    sessionEnd: serverTimestamp(),
    sessionDurationMs: durationMs,
    sessionDurationMinutes: Math.round(durationMs / 60000),
    // Financieros
    totalRake,
    jackpot,
    promotions,
    rpCommission: rpEnabled ? (totalRake * rpPct / 100) : 0,
    rpName,
    abAmount,
    rakeNeto: Math.round(rakeNeto * 100) / 100,
    tips,
    totalFichas,
    // Metricas
    rakePerHour: Math.round(rph * 100) / 100,
    rakePerHourAdjusted: Math.round(rphAdjusted * 100) / 100,
    avgPlayers: occupiedCount,
    maxSeats: tableData.maxSeats || 9,
    occupancyPct: Math.round(occupancy * 100),
    blindTier,
    // Jugadores
    players,
    // Contexto
    notes: closureData.notes || '',
    closedBy: closureData.closedBy || 'Sistema',
    createdAt: serverTimestamp(),
  };

  // Guardar en tableClosures
  const closureRef = doc(collection(db, 'tableClosures'));
  await setDoc(closureRef, closureDoc);

  // Actualizar dailyClosures
  await updateDailyClosureWithTable(tableId, closureDoc);

  // Resetear sesion de la mesa
  await resetTableSession(tableId);

  return { id: closureRef.id, ...closureDoc };
}

async function resetTableSession(tableId) {
  const ref = doc(db, 'tables', tableId);
  await updateDoc(ref, {
    sessionState: 'idle',
    sessionStartAt: null,
    pauseStartedAt: null,
    pausedTotalMs: 0,
    status: 'inactive',
    updatedAt: serverTimestamp(),
  });

  // Pausar timers de asientos
  const seatsRef = collection(db, 'tables', tableId, 'seats');
  const seatsSnap = await getDocs(seatsRef);
  const now = Date.now();
  const batch = writeBatch(db);
  seatsSnap.forEach((d) => {
    const seat = d.data();
    if (seat?.status !== 'occupied') return;
    const pt = seat.playTime || {};
    const last = typeof pt.lastTick === 'number' ? pt.lastTick : now;
    const base = Number(pt.totalMs || 0);
    const delta = Math.max(0, now - last);
    batch.update(d.ref, {
      playTime: { totalMs: base + delta, lastTick: now, paused: true },
      updatedAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

async function updateDailyClosureWithTable(tableId, closureDoc) {
  const dateKey = closureDoc.date;
  const dailyRef = doc(db, 'dailyClosures', dateKey);
  const dailySnap = await getDoc(dailyRef);

  const tableEntry = {
    tableId,
    tableName: closureDoc.tableName,
    slotNumber: closureDoc.slotNumber,
    totalRake: closureDoc.totalRake || 0,
    rakeNeto: closureDoc.rakeNeto || 0,
    rakePerHour: closureDoc.rakePerHour || 0,
    durationMinutes: closureDoc.sessionDurationMinutes || 0,
    occupancyPct: closureDoc.occupancyPct || 0,
    jackpot: closureDoc.jackpot || 0,
    tips: closureDoc.tips || 0,
    promotions: closureDoc.promotions || 0,
    rpCommission: closureDoc.rpCommission || 0,
    abAmount: closureDoc.abAmount || 0,
    totalFichas: closureDoc.totalFichas || 0,
  };

  if (dailySnap.exists()) {
    const existing = dailySnap.data();
    const tables = (existing.tables || []).filter(t => t.tableId !== tableId);
    tables.push(tableEntry);

    const totals = computeDailyTotals(tables);
    await updateDoc(dailyRef, {
      ...totals,
      tables,
      updatedAt: serverTimestamp(),
    });
  } else {
    const tables = [tableEntry];
    const totals = computeDailyTotals(tables);

    await setDoc(dailyRef, {
      date: dateKey,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      totalTables: 1,
      tables,
      ...totals,
      notes: '',
      closedBy: closureDoc.closedBy || 'Sistema',
    });
  }
}

function computeDailyTotals(tables) {
  let totalRake = 0;
  let totalRakeNeto = 0;
  let totalRakePerHour = 0;
  let totalOccupancy = 0;
  let totalJackpot = 0;
  let totalTips = 0;
  let totalPromotions = 0;
  let totalRpCommission = 0;
  let totalAbAmount = 0;
  let totalFichas = 0;
  let count = 0;

  tables.forEach(t => {
    totalRake += Number(t.totalRake || 0);
    totalRakeNeto += Number(t.rakeNeto || 0);
    totalRakePerHour += Number(t.rakePerHour || 0);
    totalOccupancy += Number(t.occupancyPct || 0);
    totalJackpot += Number(t.jackpot || 0);
    totalTips += Number(t.tips || 0);
    totalPromotions += Number(t.promotions || 0);
    totalRpCommission += Number(t.rpCommission || 0);
    totalAbAmount += Number(t.abAmount || 0);
    totalFichas += Number(t.totalFichas || 0);
    count++;
  });

  return {
    totalTables: count,
    totalRake: Math.round(totalRake * 100) / 100,
    totalRakeNeto: Math.round(totalRakeNeto * 100) / 100,
    avgRakePerHour: count > 0 ? Math.round((totalRakePerHour / count) * 100) / 100 : 0,
    avgOccupancy: count > 0 ? Math.round(totalOccupancy / count) : 0,
    totalJackpot: Math.round(totalJackpot * 100) / 100,
    totalTips: Math.round(totalTips * 100) / 100,
    totalPromotions: Math.round(totalPromotions * 100) / 100,
    totalRpCommission: Math.round(totalRpCommission * 100) / 100,
    totalAbAmount: Math.round(totalAbAmount * 100) / 100,
    totalFichas: Math.round(totalFichas * 100) / 100,
  };
}

/* =========================
   CIERRE DIARIO
   ========================= */

export async function confirmDailyClosure(dateKey, notes, closedBy) {
  const dailyRef = doc(db, 'dailyClosures', dateKey);
  const dailySnap = await getDoc(dailyRef);

  if (!dailySnap.exists()) {
    // Crear cierre diario vacio si no existe
    await setDoc(dailyRef, {
      date: dateKey,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      totalTables: 0,
      tables: [],
      totalRakeNeto: 0,
      avgRakePerHour: 0,
      avgOccupancy: 0,
      notes: notes || '',
      closedBy: closedBy || 'Sistema',
      confirmed: true,
    });
    return;
  }

  await updateDoc(dailyRef, {
    notes: notes || '',
    closedBy: closedBy || 'Sistema',
    confirmed: true,
    updatedAt: serverTimestamp(),
  });
}

/* =========================
   LISTENERS
   ========================= */

export function listenTableClosures(dateKey, callback) {
  const q = query(
    collection(db, 'tableClosures'),
    where('date', '==', dateKey || todayKey())
  );
  return onSnapshot(q, (snap) => {
    const closures = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Ordenar en cliente para evitar requerir índice compuesto en Firestore
    closures.sort((a, b) => {
      const aTime = a.closedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
      const bTime = b.closedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
    callback(closures);
  }, (err) => {
    console.error('[closureService] listenTableClosures error:', err);
    callback([]);
  });
}

export function listenDailyClosures(callback) {
  const q = query(
    collection(db, 'dailyClosures'),
    orderBy('date', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const closures = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(closures);
  }, (err) => {
    console.error('[closureService] listenDailyClosures error:', err);
    callback([]);
  });
}

export function listenTodayClosures(callback) {
  return listenTableClosures(todayKey(), callback);
}

export function getTodayDailyClosure(callback) {
  const ref = doc(db, 'dailyClosures', todayKey());
  return onSnapshot(ref, (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

/* =========================
   OBTENER DATOS UNA VEZ
   ========================= */

export async function getTableClosuresByDate(dateKey) {
  const q = query(
    collection(db, 'tableClosures'),
    where('date', '==', dateKey)
  );
  const snap = await getDocs(q);
  const closures = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  closures.sort((a, b) => {
    const aTime = a.closedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
    const bTime = b.closedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  });
  return closures;
}

export async function getDailyClosure(dateKey) {
  const ref = doc(db, 'dailyClosures', dateKey);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/* =========================
   EXPORT CSV
   ========================= */

export function exportIndividualClosureToCSV(closure) {
  const BOM = '\uFEFF';
  const sep = ',';
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

  const lines = [];

  // Sección: Información General
  lines.push('=== INFORMACIÓN GENERAL ===');
  lines.push(['Concepto', 'Valor'].join(sep));
  lines.push([q('Mesa'), q(closure.tableName)].join(sep));
  lines.push([q('Slot'), q(closure.slotNumber)].join(sep));
  lines.push([q('Juego'), q(closure.gameType)].join(sep));
  lines.push([q('Ciegas'), q(`${closure.blinds?.sb || 0}/${closure.blinds?.bb || 0}`)].join(sep));
  lines.push([q('Dealer'), q(closure.dealer || 'N/A')].join(sep));
  lines.push([q('Fecha'), q(closure.date)].join(sep));

  const sessionStart = closure.sessionStart?.toDate?.()
    ? closure.sessionStart.toDate().toLocaleString('es-MX')
    : 'N/A';
  const sessionEnd = closure.sessionEnd?.toDate?.()
    ? closure.sessionEnd.toDate().toLocaleString('es-MX')
    : new Date().toLocaleString('es-MX');
  lines.push([q('Inicio Sesión'), q(sessionStart)].join(sep));
  lines.push([q('Fin Sesión'), q(sessionEnd)].join(sep));
  lines.push([q('Duración (min)'), q(closure.sessionDurationMinutes || 0)].join(sep));
  lines.push('');

  // Sección: Financieros
  lines.push('=== RESUMEN FINANCIERO ===');
  lines.push(['Concepto', 'Monto'].join(sep));
  lines.push([q('Rake Total'), q(closure.totalRake || 0)].join(sep));
  lines.push([q('Jackpot'), q(closure.jackpot || 0)].join(sep));
  lines.push([q('Promociones'), q(closure.promotions || 0)].join(sep));
  lines.push([q('RP Comisión'), q(closure.rpCommission || 0)].join(sep));
  lines.push([q('RP Nombre'), q(closure.rpName || '')].join(sep));
  lines.push([q('A&B'), q(closure.abAmount || 0)].join(sep));
  lines.push([q('Rake Neto'), q(closure.rakeNeto || 0)].join(sep));
  lines.push([q('Propinas'), q(closure.tips || 0)].join(sep));
  lines.push([q('Total Fichas (Flujo)'), q(closure.totalFichas || 0)].join(sep));
  lines.push('');

  // Sección: Métricas
  lines.push('=== MÉTRICAS ===');
  lines.push(['Concepto', 'Valor'].join(sep));
  lines.push([q('Rake/Hora'), q(closure.rakePerHour || 0)].join(sep));
  lines.push([q('Rake/Hora Ajustado'), q(closure.rakePerHourAdjusted || 0)].join(sep));
  lines.push([q('Ocupación %'), q(closure.occupancyPct || 0)].join(sep));
  lines.push([q('Jugadores Promedio'), q(closure.avgPlayers || 0)].join(sep));
  lines.push([q('Max Asientos'), q(closure.maxSeats || 0)].join(sep));
  lines.push([q('Nivel Ciegas'), q(closure.blindTier || '')].join(sep));
  lines.push([q('Notas'), q(closure.notes || '')].join(sep));
  lines.push([q('Cerrado Por'), q(closure.closedBy || '')].join(sep));
  lines.push('');

  // Sección: Jugadores
  lines.push('=== JUGADORES EN LA MESA ===');
  lines.push(['Asiento', 'Jugador', 'Fichas', 'Buy-ins', 'Tiempo (min)'].join(sep));
  (closure.players || []).forEach(p => {
    lines.push([
      q(p.seatNumber),
      q(p.name),
      q(p.chips),
      q(p.buyIns),
      q(Math.round((p.playTimeMs || 0) / 60000))
    ].join(sep));
  });

  const content = `${BOM}${lines.join('\n')}`;
  downloadCSV(content, `cierre_${closure.tableName}_${closure.date}.csv`);
}

export function exportDailyClosureToCSV(dailyClosure, tableClosures) {
  const BOM = '\uFEFF';
  const sep = ';';

  // Resumen general
  const summaryHeader = [
    'Fecha', 'Total Mesas', 'Rake Neto Total', 'Rake/Hora Promedio',
    'Ocupacion Promedio %', 'Cerrado Por', 'Notas'
  ].join(sep);

  const summaryRow = [
    dailyClosure.date,
    dailyClosure.totalTables || 0,
    dailyClosure.totalRakeNeto || 0,
    dailyClosure.avgRakePerHour || 0,
    dailyClosure.avgOccupancy || 0,
    dailyClosure.closedBy || '',
    dailyClosure.notes || '',
  ].join(sep);

  // Detalle por mesa
  const detailHeader = [
    'Mesa', 'Slot', 'Rake Neto', 'Rake/Hora', 'Duracion (min)', 'Ocupacion %'
  ].join(sep);

  const detailRows = (dailyClosure.tables || []).map(t =>
    [t.tableName, t.slotNumber, t.rakeNeto, t.rakePerHour, t.durationMinutes, t.occupancyPct].join(sep)
  ).join('\n');

  // Detalle jugadores (si hay tableClosures)
  let playerSection = '';
  if (tableClosures && tableClosures.length > 0) {
    const playerHeader = ['Mesa', 'Asiento', 'Jugador', 'Fichas', 'Buy-ins', 'Tiempo (min)'].join(sep);
    const playerRows = [];
    tableClosures.forEach(tc => {
      (tc.players || []).forEach(p => {
        playerRows.push([
          tc.tableName, p.seatNumber, p.name, p.chips, p.buyIns,
          Math.round((p.playTimeMs || 0) / 60000)
        ].join(sep));
      });
    });
    playerSection = `\n\n${playerHeader}\n${playerRows.join('\n')}`;
  }

  const content = `${BOM}RESUMEN DIARIO\n${summaryHeader}\n${summaryRow}\n\nDETALLE POR MESA\n${detailHeader}\n${detailRows}${playerSection}`;
  downloadCSV(content, `cierre_diario_${dailyClosure.date}.csv`);
}

export function exportMultipleClosuresToCSV(closures, dateKey) {
  const BOM = '\uFEFF';
  const sep = ';';

  const header = [
    'Mesa', 'Slot', 'Juego', 'Ciegas',
    'Fecha', 'Duracion (min)',
    'Rake Total', 'Jackpot', 'Promociones', 'RP Comision',
    'Rake Neto', 'Propinas',
    'Rake/Hora', 'Rake/Hora Ajustado', 'Ocupacion %',
    'Jugadores', 'Max Asientos', 'Nivel', 'Notas'
  ].join(sep);

  const rows = closures.map(c => [
    c.tableName, c.slotNumber, c.gameType,
    `${c.blinds?.sb || 0}/${c.blinds?.bb || 0}`,
    c.date, c.sessionDurationMinutes || 0,
    c.totalRake || 0, c.jackpot || 0, c.promotions || 0, c.rpCommission || 0,
    c.rakeNeto || 0, c.tips || 0,
    c.rakePerHour || 0, c.rakePerHourAdjusted || 0, c.occupancyPct || 0,
    c.avgPlayers || 0, c.maxSeats || 0, c.blindTier || '', c.notes || ''
  ].join(sep)).join('\n');

  // Totales
  const totalRakeNeto = closures.reduce((s, c) => s + (c.rakeNeto || 0), 0);
  const totalTips = closures.reduce((s, c) => s + (c.tips || 0), 0);
  const totalRake = closures.reduce((s, c) => s + (c.totalRake || 0), 0);
  const avgRPH = closures.length > 0
    ? closures.reduce((s, c) => s + (c.rakePerHour || 0), 0) / closures.length
    : 0;

  const totals = `\n\nTOTALES\nMesas Cerradas${sep}${closures.length}\nRake Total${sep}${fmt(totalRake, 0)}\nRake Neto Total${sep}${fmt(totalRakeNeto, 0)}\nPropinas Totales${sep}${fmt(totalTips, 0)}\nRake/Hora Promedio${sep}${fmt(avgRPH, 0)}`;

  const content = `${BOM}CIERRES DEL ${dateKey || todayKey()}\n\n${header}\n${rows}${totals}`;
  downloadCSV(content, `cierres_${dateKey || todayKey()}.csv`);
}

function downloadCSV(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* =========================
   RPH BASELINES (auto-calibrado)
   ========================= */

export async function getRPHBaseline(blindTier) {
  const ref = doc(db, 'meta', 'rphBaselines');
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  return data[blindTier] || null;
}

export async function updateRPHBaselines() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const dateKey = thirtyDaysAgo.toISOString().slice(0, 10);

  const q = query(
    collection(db, 'tableClosures'),
    where('date', '>=', dateKey)
  );
  const snap = await getDocs(q);
  const closures = snap.docs.map(d => d.data());

  const tiers = {};
  closures.forEach(c => {
    const tier = c.blindTier;
    if (!tier || !c.rakePerHour) return;
    if (!tiers[tier]) tiers[tier] = [];
    tiers[tier].push(c.rakePerHour);
  });

  const baselines = {};
  Object.keys(tiers).forEach(tier => {
    const values = tiers[tier];
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    baselines[tier] = {
      avg: Math.round(avg * 100) / 100,
      min: Math.round(Math.min(...values) * 100) / 100,
      max: Math.round(Math.max(...values) * 100) / 100,
      count: values.length,
      updatedAt: new Date().toISOString(),
    };
  });

  if (Object.keys(baselines).length > 0) {
    await setDoc(doc(db, 'meta', 'rphBaselines'), baselines, { merge: true });
  }

  return baselines;
}

/* =========================
   GOOGLE SHEETS EXPORTS
   ========================= */

export async function exportDailyClosureToSheets(dateKey) {
  // 1. Obtener cierre diario
  const daily = await getDailyClosure(dateKey);
  if (!daily) throw new Error(`No se encontró el cierre diario para la fecha ${dateKey}`);

  // 2. Obtener cierres de mesa individuales de esa fecha operativa
  const tables = await getTableClosuresByDate(dateKey);

  // 3. Exportar a Google Sheets
  const payload = {
    dailyClosure: daily,
    tableClosures: tables
  };

  const result = await exportToGoogleSheets('daily_closure', dateKey, payload);

  // 4. Guardar URL en el documento de dailyClosures
  const dailyRef = doc(db, 'dailyClosures', dateKey);
  await updateDoc(dailyRef, {
    googleSheetsUrl: result.url,
    updatedAt: serverTimestamp()
  });

  return result;
}

export async function exportIndividualClosureToSheets(closureId) {
  // 1. Obtener cierre individual
  const ref = doc(db, 'tableClosures', closureId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error(`No se encontró el cierre de mesa con ID ${closureId}`);
  const closure = { id: snap.id, ...snap.data() };

  // 2. Exportar a Google Sheets
  const payload = {
    tableClosure: closure
  };

  const result = await exportToGoogleSheets('table_closure', closure.date, payload);

  // 3. Guardar URL en el documento de tableClosures
  await updateDoc(ref, {
    googleSheetsUrl: result.url,
    updatedAt: serverTimestamp()
  });

  return result;
}
