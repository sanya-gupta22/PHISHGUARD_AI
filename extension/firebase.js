// firebase.js
import { initializeApp } from "firebase/app";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    limit,
    where,
    deleteDoc,
    doc,
    updateDoc,
    Timestamp,
    writeBatch
} from "firebase/firestore";
 
// ===================================
// FIREBASE CONFIG (YOUR ACTUAL CONFIG)
// ===================================
const firebaseConfig = {
    apiKey: "AIzaSyAFcj5O7hCawVIWwSvF9uVOx9_uTKAzNfM",
    authDomain: "phishguard-ai-1b430.firebaseapp.com",
    projectId: "phishguard-ai-1b430",
    storageBucket: "phishguard-ai-1b430.appspot.com",
    messagingSenderId: "197789399403",
    appId: "1:197789399403:web:cf53930d084218c58db42e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===================================
// SAVE SINGLE HISTORY ENTRY
// ===================================
export async function saveHistoryToFirebase(data) {
    try {
        // Ensure timestamp is properly formatted
        const historyData = {
            ...data,
            timestamp: data.timestamp || Timestamp.now(),
            savedAt: new Date().toISOString(),
            firestoreId: null // Will be set after save
        };
        
        // Remove id if exists (let Firestore generate its own)
        if (historyData.id) {
            delete historyData.id;
        }
        
        const docRef = await addDoc(collection(db, "history"), historyData);
        console.log(" History saved to Firebase with ID:", docRef.id);
        
        // Return the document ID
        return docRef.id;
    } catch (error) {
        console.error(" Firebase Save Error:", error);
        return null;
    }
}

// ===================================
// SAVE BATCH HISTORY ENTRIES
// ===================================
export async function saveBatchHistoryToFirebase(historyArray) {
    try {
        const batch = writeBatch(db);
        const collectionRef = collection(db, "history");
        
        for (const item of historyArray) {
            const { id, ...cleanItem } = item;
            const newDocRef = doc(collectionRef);
            batch.set(newDocRef, {
                ...cleanItem,
                timestamp: item.timestamp || Timestamp.now(),
                savedAt: new Date().toISOString()
            });
        }
        
        await batch.commit();
        console.log(` Saved ${historyArray.length} history entries to Firebase`);
        return true;
    } catch (error) {
        console.error(" Firebase Batch Save Error:", error);
        return false;
    }
}

// ===================================
// GET ALL HISTORY
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
        
        console.log(` Fetched ${history.length} history entries from Firebase`);
        return history;
    } catch (error) {
        console.error(" Firebase Fetch Error:", error);
        return [];
    }
}

// ===================================
// DELETE HISTORY ENTRY
// ===================================
export async function deleteHistoryFromFirebase(docId) {
    try {
        await deleteDoc(doc(db, "history", docId));
        console.log(" History entry deleted from Firebase");
        return true;
    } catch (error) {
        console.error(" Firebase Delete Error:", error);
        return false;
    }
}

// ===================================
// CLEAR ALL HISTORY
// ===================================
export async function clearAllHistoryFromFirebase() {
    try {
        const allHistory = await getHistoryFromFirebase();
        const batch = writeBatch(db);
        
        for (const item of allHistory) {
            const docRef = doc(db, "history", item.id);
            batch.delete(docRef);
        }
        
        await batch.commit();
        console.log(` Cleared ${allHistory.length} history entries from Firebase`);
        return true;
    } catch (error) {
        console.error(" Firebase Clear Error:", error);
        return false;
    }
}

export { db };