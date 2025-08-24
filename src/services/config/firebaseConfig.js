// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// TODO: Reemplaza esto con la configuración de tu propio proyecto de Firebase
const firebaseConfig = {
      apiKey: "AIzaSyAtX_lsgN49FPvXwyOslKdFOIjwJDzqqKk",
      authDomain: "poker-room-2.firebaseapp.com",
      projectId: "poker-room-2",
      storageBucket: "poker-room-2.firebasestorage.app",
      messagingSenderId: "222798291312",
      appId: "1:222798291312:web:88d22239cbd43e7b26efb5"
    };

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Exportar la instancia de Firestore para usarla en otras partes de la app
export const db = getFirestore(app);