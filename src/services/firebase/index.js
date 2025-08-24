// src/services/firebase/index.js

import {
  listenToTableData,
  updateTableStatus,
  getTableReportData
} from './tableService.js';

import {
  addToWaitingList,
  removePlayerFromWaitingList,
  listenToWaitingList
} from './waitingListService.js';

import {
  assignPlayerToSeat,
  listenToSeats
} from './seatService.js';

export {
  // Table
  listenToTableData,
  updateTableStatus,
  getTableReportData,

  // Waiting List
  addToWaitingList,
  removePlayerFromWaitingList,
  listenToWaitingList,

  // Seats
  assignPlayerToSeat,
  listenToSeats
};
export { addChipsToPlayer, cashOutPlayer } from './playerService';

