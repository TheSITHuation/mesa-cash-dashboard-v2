import { db } from '../services/config/firebaseConfig.js';
import { collection, getDocs } from 'firebase/firestore';

export async function peekSeats(tableId) {
  const col = collection(db, 'tables', tableId, 'seats');
  const qs = await getDocs(col);
  console.log('[peek] seats docs:', qs.size);
  qs.forEach(d => console.log(d.id, d.data()));
  return qs.size;
}
