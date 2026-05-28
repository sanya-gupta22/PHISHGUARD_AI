// firebase.js

import { initializeApp }
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    query,
    orderBy
}
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


// ===================================
// FIREBASE CONFIG
// ===================================

const firebaseConfig = {

    apiKey: "AIzaSyAFcj5O7hCawVIWwSvF9uVOx9_uTKAzNfM",

    authDomain: "phishguard-ai-1b430.firebaseapp.com",

    projectId: "phishguard-ai-1b430",

    storageBucket: "phishguard-ai-1b430.appspot.com",

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

export async function saveHistoryToFirebase(data) {

    try {

        await addDoc(
            collection(db, "history"),
            data
        );

        console.log("History saved to Firebase");

    } catch (error) {

        console.error("Firebase Save Error:", error);
    }
}


// ===================================
// GET HISTORY
// ===================================

export async function getHistoryFromFirebase() {

    try {

        const q = query(
            collection(db, "history"),
            orderBy("timestamp", "desc")
        );

        const querySnapshot = await getDocs(q);

        const history = [];

        querySnapshot.forEach((doc) => {

            history.push({
                id: doc.id,
                ...doc.data()
            });

        });

        return history;

    } catch (error) {

        console.error("Firebase Fetch Error:", error);

        return [];
    }
}

export { db };

