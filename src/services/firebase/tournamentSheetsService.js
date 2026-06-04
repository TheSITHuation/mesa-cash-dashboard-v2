import { exportToGoogleSheets } from './googleSheetsService.js';
import { getDaySnapshots } from './tournamentSnapshotService.js';

function makeDayRow(econ) {
  return {
    dayLabel: 'Único día',
    savedAt: new Date().toISOString().slice(0, 10),
    entries: econ?.buyinsCount || 0,
    rebuys: econ?.rebuysCount || 0,
    addons: econ?.addonsCount || 0,
    totalBuyinsAmount: econ?.totalBuyinsAmount || 0,
    totalRebuysAmount: econ?.totalRebuysAmount || 0,
    totalAddonsAmount: econ?.totalAddonsAmount || 0,
    totalBuyinsRake: econ?.totalBuyinsRake || 0,
    totalRebuysRake: econ?.totalRebuysRake || 0,
    totalAddonsRake: econ?.totalAddonsRake || 0,
  };
}

function sumEcon(rows) {
  return {
    entries: rows.reduce((s, r) => s + r.entries, 0),
    rebuys: rows.reduce((s, r) => s + r.rebuys, 0),
    addons: rows.reduce((s, r) => s + r.addons, 0),
    totalAmount: rows.reduce((s, r) => s + r.totalBuyinsAmount + r.totalRebuysAmount + r.totalAddonsAmount, 0),
    totalRake: rows.reduce((s, r) => s + r.totalBuyinsRake + r.totalRebuysRake + r.totalAddonsRake, 0),
  };
}

export async function exportTournamentToSheets(tournamentId, tournamentName, liveEcon, config) {
  const isMultiDay = config?.multiDay === true;
  let days, total;

  if (isMultiDay) {
    const snapshots = await getDaySnapshots(tournamentId);
    days = snapshots.map(s => makeDayRow(s.econ));
    total = sumEcon([...days, makeDayRow(liveEcon)]);
  } else {
    days = [makeDayRow(liveEcon)];
    total = sumEcon(days);
  }

  const guarantee = Number(config?.guarantee || 0);
  const rakePct = Number(config?.rakePct || 0) / 100;
  const targetRake = total.totalAmount * rakePct;
  const prizePool = Math.max(guarantee, total.totalAmount - targetRake);
  const roomProfit = total.totalAmount - prizePool;

  const payload = {
    type: 'tournament_export',
    tournamentName: tournamentName || 'Torneo',
    tournamentId,
    isMultiDay,
    days,
    total: {
      ...total,
      prizePool,
      roomProfit,
      guarantee,
      rakePct: config?.rakePct || 0,
    },
    exportedAt: new Date().toISOString(),
  };

  return await exportToGoogleSheets('tournament_export', new Date().toISOString().slice(0, 10), payload);
}
