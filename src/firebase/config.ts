
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDlRXHvh-V-zmlOM64CdFV3GP9ONC_RANM",
  authDomain: "fluxoadm.firebaseapp.com",
  projectId: "fluxoadm",
  storageBucket: "fluxoadm.firebasestorage.app",
  messagingSenderId: "700073814298",
  appId: "1:700073814298:web:72040fd4fb7b1df25f24a3"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
