// src/utils/getTableId.js
export function getTableId() {
  // 1) fuente global/recordada (la “oficial”)
  const mem = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('activeTableId')) || null;
  const global = typeof window !== 'undefined' ? (window.__ACTIVE_TABLE_ID || null) : null;
  if (global) return global;
  if (mem) return mem;

  // 2) fallback a la URL
  const p = new URLSearchParams(location.search).get('table');
  return p || null;
}
