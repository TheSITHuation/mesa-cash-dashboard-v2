// utils/timeFormatter.js

// ✅ Utilidad para convertir minutos a formato hh:mm:ss
export function formatMinutesToHHMMSS(minutes) {
  const totalSeconds = Math.floor(minutes * 60);
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  return `${hrs.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
