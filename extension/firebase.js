import { initializeApp }
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
    getFirestore,
    collection,
    addDoc,
    getDocs
}
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ===================================
// FIREBASE CONFIG
// ===================================

const firebaseConfig = {
  apiKey: "AIzaSyAFcj5O7hCawVIWwSvF9uVOx9_uTKAzNfM",
  authDomain: "phishguard-ai-1b430.firebaseapp.com",
  projectId: "phishguard-ai-1b430",
  storageBucket: "phishguard-ai-1b430.firebasestorage.app",
  messagingSenderId: "197789399403",
  appId: "1:197789399403:web:cf53930d084218c58db42e"
};


// ===================================
// INITIALIZE FIREBASE
// ===================================

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

// ===================================
// SAVE HISTORY
// ===================================

export async function saveHistoryToFirebase(data){

    try {

        await addDoc(
            collection(db, "history"),
            data
        );

        console.log(
            "History saved to Firebase"
        );

    } catch(error){

        console.error(
            "Firebase Save Error:",
            error
        );
    }
}

// ===================================
// GET HISTORY
// ===================================

export async function getHistoryFromFirebase(){

    try {

        const querySnapshot =
            await getDocs(
                collection(db, "history")
            );

        const history = [];

        querySnapshot.forEach((doc) => {

            history.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return history;

    } catch(error){

        console.error(
            "Firebase Fetch Error:",
            error
        );

        return [];
    }
}

export { db };








// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAFcj5O7hCawVIWwSvF9uVOx9_uTKAzNfM",
  authDomain: "phishguard-ai-1b430.firebaseapp.com",
  projectId: "phishguard-ai-1b430",
  storageBucket: "phishguard-ai-1b430.firebasestorage.app",
  messagingSenderId: "197789399403",
  appId: "1:197789399403:web:cf53930d084218c58db42e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);