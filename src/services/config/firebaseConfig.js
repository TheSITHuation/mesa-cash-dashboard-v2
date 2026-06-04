// src/service/config/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import {
  getAuth, onAuthStateChanged,
  signInWithEmailAndPassword, signOut,
  GoogleAuthProvider, signInWithPopup,
  sendPasswordResetEmail,
  createUserWithEmailAndPassword, updateProfile,
  sendEmailVerification
} from "firebase/auth";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FB_API_KEY,
  authDomain:        import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FB_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FB_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FB_APP_ID,
};

const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

import { setPersistence, browserLocalPersistence } from "firebase/auth";
setPersistence(auth, browserLocalPersistence).catch(err => console.error("Error en persistencia:", err));

export const watchAuth = (cb) => onAuthStateChanged(auth, cb);
export const loginWithEmail = (email, pass) => signInWithEmailAndPassword(auth, email, pass);
export const loginWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
};
export const logout = () => signOut(auth);
export const sendRecoveryEmail = (email) => sendPasswordResetEmail(auth, email);
export const sendVerification = (user) => sendEmailVerification(user);

export const registerUser = async (email, password, displayName) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName });
  await sendEmailVerification(cred.user);
  return cred;
};
