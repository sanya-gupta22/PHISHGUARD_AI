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

    apiKey: "YOUR_API_KEY",

    authDomain:
        "YOUR_PROJECT.firebaseapp.com",

    projectId:
        "YOUR_PROJECT_ID",

    storageBucket:
        "YOUR_PROJECT.appspot.com",

    messagingSenderId:
        "YOUR_SENDER_ID",

    appId:
        "YOUR_APP_ID"
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