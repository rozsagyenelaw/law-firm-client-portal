// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDhwG6_wonaWEaC4S4GlNYm4jwHoBKG_hI",
  authDomain: "livingtrust-california.firebaseapp.com",
  projectId: "livingtrust-california",
  storageBucket: "livingtrust-california.firebasestorage.app",
  messagingSenderId: "444189733421",
  appId: "1:444189733421:web:290715daa988c4329dbea4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
