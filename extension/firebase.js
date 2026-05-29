// firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
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
    Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
// SAVE SINGLE HISTORY ENTRY
// ===================================
export async function saveHistoryToFirebase(data) {
    try {
        // Add timestamp if not present
        const historyData = {
            ...data,
            timestamp: data.timestamp || Timestamp.now(),
            savedAt: new Date().toISOString()
        };
        
        const docRef = await addDoc(collection(db, "history"), historyData);
        console.log("History saved to Firebase with ID:", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error("Firebase Save Error:", error);
        return null;
    }
}

// ===================================
// SAVE MULTIPLE HISTORY ENTRIES (BATCH)
// ===================================
export async function saveBatchHistoryToFirebase(historyArray) {
    try {
        const batch = [];
        for (const item of historyArray) {
            const historyData = {
                ...item,
                timestamp: item.timestamp || Timestamp.now(),
                savedAt: new Date().toISOString()
            };
            batch.push(addDoc(collection(db, "history"), historyData));
        }
        await Promise.all(batch);
        console.log(`Saved ${historyArray.length} history entries to Firebase`);
        return true;
    } catch (error) {
        console.error("Firebase Batch Save Error:", error);
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
        console.log(`Fetched ${history.length} history entries from Firebase`);
        return history;
    } catch (error) {
        console.error("Firebase Fetch Error:", error);
        return [];
    }
}

// ===================================
// GET HISTORY WITH FILTERS (for dashboard)
// ===================================
export async function getFilteredHistoryFromFirebase(prediction = null, limitCount = 100) {
    try {
        let q = query(collection(db, "history"), orderBy("timestamp", "desc"), limit(limitCount));
        
        if (prediction) {
            q = query(
                collection(db, "history"),
                where("prediction", "==", prediction),
                orderBy("timestamp", "desc"),
                limit(limitCount)
            );
        }
        
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
        console.error("Firebase Filtered Fetch Error:", error);
        return [];
    }
}

// ===================================
// GET STATS FOR DASHBOARD
// ===================================
export async function getDashboardStatsFromFirebase() {
    try {
        const allHistory = await getHistoryFromFirebase();
        const total = allHistory.length;
        const phishing = allHistory.filter(item => item.prediction === "Phishing").length;
        const safe = allHistory.filter(item => item.prediction === "Safe").length;
        const highRisk = allHistory.filter(item => item.risk === "High").length;
        const mediumRisk = allHistory.filter(item => item.risk === "Medium").length;
        const lowRisk = allHistory.filter(item => item.risk === "Low" || item.prediction === "Safe").length;
        
        // Get keyword frequency
        const keywordMap = new Map();
        const phishingKeywords = ['urgent', 'verify', 'password', 'click', 'bank', 'account', 'suspended'];
        
        allHistory.filter(item => item.prediction === "Phishing").forEach(item => {
            const emailContent = (item.email || "").toLowerCase();
            phishingKeywords.forEach(keyword => {
                if (emailContent.includes(keyword)) {
                    keywordMap.set(keyword, (keywordMap.get(keyword) || 0) + 1);
                }
            });
        });
        
        const topKeywords = Array.from(keywordMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        // Get domain frequency
        const domainMap = new Map();
        allHistory.forEach(item => {
            const domain = item.senderDomain || "";
            if (domain) {
                domainMap.set(domain, (domainMap.get(domain) || 0) + 1);
            }
        });
        
        const topDomains = Array.from(domainMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        
        return {
            total,
            safe,
            phishing,
            highRisk,
            mediumRisk,
            lowRisk,
            topKeywords,
            topDomains
        };
    } catch (error) {
        console.error("Firebase Stats Error:", error);
        return null;
    }
}

// ===================================
// DELETE HISTORY ENTRY
// ===================================
export async function deleteHistoryFromFirebase(docId) {
    try {
        await deleteDoc(doc(db, "history", docId));
        console.log("History entry deleted from Firebase");
        return true;
    } catch (error) {
        console.error("Firebase Delete Error:", error);
        return false;
    }
}

// ===================================
// UPDATE HISTORY ENTRY
// ===================================
export async function updateHistoryInFirebase(docId, updatedData) {
    try {
        const docRef = doc(db, "history", docId);
        await updateDoc(docRef, {
            ...updatedData,
            updatedAt: new Date().toISOString()
        });
        console.log("History entry updated in Firebase");
        return true;
    } catch (error) {
        console.error("Firebase Update Error:", error);
        return false;
    }
}

// ===================================
// CLEAR ALL HISTORY
// ===================================
export async function clearAllHistoryFromFirebase() {
    try {
        const allHistory = await getHistoryFromFirebase();
        const deletePromises = allHistory.map(item => deleteDoc(doc(db, "history", item.id)));
        await Promise.all(deletePromises);
        console.log(`Cleared ${allHistory.length} history entries from Firebase`);
        return true;
    } catch (error) {
        console.error("Firebase Clear Error:", error);
        return false;
    }
}

export { db };