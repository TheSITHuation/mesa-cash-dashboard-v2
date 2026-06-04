// src/utils/modalBridge.js
export function emitOpenSeatModal(seatId, seatInfo = {}, extra = {}) {
  window.dispatchEvent(new CustomEvent('open-seat-modal', {
    detail: { seatId, seatInfo, ...extra }
  }));
}

export function emitOpenPlayerCard(seatId, seatInfo = {}) {
  window.dispatchEvent(new CustomEvent('open-player-card', {
    detail: { seatId, seatInfo }
  }));
}