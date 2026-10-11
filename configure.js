
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Replace these values with your Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyA7hVg8HF1FbpqtQwjn6ImBWkNXA_Beytk",
  authDomain: "moneta-613d8.firebaseapp.com",
  projectId: "moneta-613d8",
  storageBucket: "moneta-613d8.firebasestorage.app",
  messagingSenderId: "328327093977",
  appId: "1:328327093977:web:a2a3b21735c731a4a168c8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Authentication and database
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
