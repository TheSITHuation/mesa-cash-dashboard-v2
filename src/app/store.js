// src/app/store.js
// Mini store simple (pub/sub) para estado global básico.

const state = {
  tableId: null,
  seats: {},
};

const subs = new Map();

export function getState() {
  return { ...state };
}

export function setState(patch) {
  Object.assign(state, patch);
  for (const cb of subs.values()) {
    try { cb(getState()); } catch (e) { console.error("[store] subscriber error:", e); }
  }
}

/**
 * @param {string} key - identificador del suscriptor
 * @param {(state: any) => void} cb
 * @returns {() => void} - para desuscribirse
 */
export function subscribe(key, cb) {
  subs.set(key, cb);
  return () => subs.delete(key);
}
