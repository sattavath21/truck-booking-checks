import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs,
    addDoc,
    writeBatch,
    query,
    where,
    orderBy,
    doc,
    deleteDoc,
    updateDoc,
    limit
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAfRm6yu1tCk0qgWfW6UcfvcqF1zAxnoBQ",
    authDomain: "device-streaming-70248ccc.firebaseapp.com",
    projectId: "device-streaming-70248ccc",
    storageBucket: "device-streaming-70248ccc.firebasestorage.app",
    messagingSenderId: "993682748672",
    appId: "1:993682748672:web:5bf00418b42a13c0dbafe5"
};

const COLLECTION_NAME = 'LogisticsData';

class TruckDB {
    constructor() {
        this.app = null;
        this.db = null;
    }

    async init() {
        if (!this.app) {
            this.app = initializeApp(firebaseConfig);
            this.db = getFirestore(this.app);
        }
        return this.db;
    }

    async getAllBookings(rowLimit = 10) {
        const now = Date.now();
        const threeDaysAgo = now - (3 * 24 * 60 * 60 * 1000);

        const q = query(
            collection(this.db, COLLECTION_NAME),
            where("timestamp", ">=", threeDaysAgo),
            orderBy("timestamp", "desc"),
            limit(rowLimit)
        );

        const querySnapshot = await getDocs(q);
        const data = [];
        querySnapshot.forEach((doc) => {
            const itemData = doc.data();
            data.push({ ...itemData, id: doc.id });
        });
        return data;
    }

    normalize(text) {
        if (!text) return '';
        // Same normalization as before for consistency
        return text.toString().toUpperCase()
            .replace(/[^A-Z0-9ก-ฮก-ຮ]/g, '');
    }

    async searchPlate(plate) {
        if (!plate) return [];
        const target = this.normalize(plate);

        // Use direct Firestore query for efficiency
        const q = query(
            collection(this.db, COLLECTION_NAME),
            where("truck_norm", "==", target),
            orderBy("timestamp", "desc"),
            limit(50) // Return enough results for search
        );

        const querySnapshot = await getDocs(q);
        const data = [];
        querySnapshot.forEach((doc) => {
            data.push({ ...doc.data(), id: doc.id });
        });
        return data;
    }

    async clearAll() {
        const q = query(collection(this.db, COLLECTION_NAME));
        const querySnapshot = await getDocs(q);
        const batch = writeBatch(this.db);

        querySnapshot.forEach((document) => {
            batch.delete(doc(this.db, COLLECTION_NAME, document.id));
        });

        await batch.commit();
    }

    async updateBooking(id, data) {
        try {
            console.log("Updating Firestore doc:", id, data);
            const docRef = doc(this.db, COLLECTION_NAME, id);
            await updateDoc(docRef, data);
            return { success: true };
        } catch (error) {
            console.error("Firestore update failed for ID:", id, error);
            throw error;
        }
    }

    async seedData(dataArray) {
        // Firestore batch has a limit of 500 operations
        const BATCH_SIZE = 500;
        for (let i = 0; i < dataArray.length; i += BATCH_SIZE) {
            const batch = writeBatch(this.db);
            const chunk = dataArray.slice(i, i + BATCH_SIZE);
            chunk.forEach(item => {
                // Use the provided ID as document name if available, else auto-gen
                const docRef = item.id
                    ? doc(this.db, COLLECTION_NAME, item.id)
                    : doc(collection(this.db, COLLECTION_NAME));
                batch.set(docRef, item);
            });
            await batch.commit();
        }
    }

    async syncFromCloud() {
        // Now it's already cloud-first!
        console.log('Using Firestore Cloud Database.');
    }
}

const dbInstance = new TruckDB();
window.truckDB = dbInstance; // Make it accessible globally
