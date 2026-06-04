import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebaseConfig.js';

export async function saveDaySnapshot(tournamentId, dayLabel, econ, raw, tournamentName) {
  const ref = doc(db, 'td3', tournamentId, 'snapshots', dayLabel);
  await setDoc(ref, {
    dayLabel,
    savedAt: serverTimestamp(),
    tournamentName: tournamentName || '',
    econ: econ || {},
    raw: raw || {},
  });
}

export async function getDaySnapshots(tournamentId) {
  const ref = collection(db, 'td3', tournamentId, 'snapshots');
  const snap = await getDocs(ref);
  const list = [];
  snap.forEach(d => {
    const data = d.data();
    list.push({
      dayLabel: data.dayLabel || d.id,
      savedAt: data.savedAt?.toDate ? data.savedAt.toDate() : (data.savedAt || null),
      tournamentName: data.tournamentName || '',
      econ: data.econ || {},
      raw: data.raw || {},
    });
  });
  list.sort((a, b) => (a.savedAt?.getTime?.() || 0) - (b.savedAt?.getTime?.() || 0));
  return list;
}

export async function deleteDaySnapshot(tournamentId, dayLabel) {
  const ref = doc(db, 'td3', tournamentId, 'snapshots', dayLabel);
  await deleteDoc(ref);
}
