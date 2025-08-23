// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDvpy1J7FggY2nA07F5oSX5wIWLj1vLgaQ",
  authDomain: "law-firm-client-portal.firebaseapp.com",
  projectId: "law-firm-client-portal",
  storageBucket: "law-firm-client-portal.firebasestorage.app",
  messagingSenderId: "1012595229",
  appId: "1:1012595229:web:2ba56185a9eefba5d0a4f4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize Functions with the correct region
export const functions = getFunctions(app, 'us-central1');

// Stripe publishable key
export const STRIPE_PUBLISHABLE_KEY = "pk_live_51RQxRiLLy2lrya6t1VUp5Zl0kOvs0TprmtQMPO4uxrTimy7RqqX9XFyMzMMelV7jDOSGTrY29Lne4nLKiOINxtRr00Bd3kmxBb";

export default app;