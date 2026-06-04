import { db } from '../config/firebaseConfig.js';
import { collection, setDoc, doc } from 'firebase/firestore';

export async function initSeatsForTable(tableId, totalSeats = 9) {
  const seatsCollectionRef = collection(db, 'tables', tableId, 'seats');

  for (let i = 1; i <= totalSeats; i++) {
    const seatRef = doc(seatsCollectionRef, `seat_${i}`);
    await setDoc(seatRef, {
      seatNumber: i,
      status: 'available',
      playerName: '',
      chips: 0,
      avatarUrl: ''
    });
  }


}
