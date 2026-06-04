// src/utils/cleanupSubcollections.js

import { db } from '../config/firebaseConfig.js';
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { getTableId } from './getTableId.js';

export async function cleanupSeatsSubcollection() {
  const tableId = getTableId();
  const subcollectionRef = collection(db, 'tables', tableId, 'seats');
  const snapshot = await getDocs(subcollectionRef);

  const deletions = snapshot.docs.map(docSnap =>
    deleteDoc(doc(db, 'tables', tableId, 'seats', docSnap.id))
  );

  await Promise.all(deletions);


}
