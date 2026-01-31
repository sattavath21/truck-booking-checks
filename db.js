import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
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
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDZjIOStlLjALPlXMqDMRX1SWA7beHkJjw",
    authDomain: "truck-booking-checks.firebaseapp.com",
    projectId: "truck-booking-checks",
    storageBucket: "truck-booking-checks.firebasestorage.app",
    messagingSenderId: "298028376982",
    appId: "1:298028376982:web:5a8c3603b3e998f7e5f3b7"
};

const COLLECTION_NAME = 'LogisticsData';

class TruckDB {
    constructor() {
        this.app = null;
        this.db = null;
        this.cache = null;
        this.cacheTimestamp = 0;
        this.CACHE_DURATION = 30000; // 30 seconds
    }

    async init() {
        if (!this.app) {
            this.app = initializeApp(firebaseConfig);
            this.db = getFirestore(this.app);
        }
        return this.db;
    }

    async getAllBookings(rowLimit = 100, forceRefresh = false) {
        const now = Date.now();

        // Return cache if valid and not forcing refresh
        if (!forceRefresh && this.cache && (now - this.cacheTimestamp < this.CACHE_DURATION)) {
            console.log("Returning cached bookings");
            return this.cache.slice(0, rowLimit);
        }

        const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

        const q = query(
            collection(this.db, COLLECTION_NAME),
            where("timestamp", ">=", sevenDaysAgo),
            orderBy("timestamp", "desc"),
            limit(1000) // Fetch more than requested for cache
        );

        console.log("Fetching bookings from Firestore...");
        const querySnapshot = await getDocs(q);
        const data = [];
        querySnapshot.forEach((doc) => {
            const itemData = doc.data();
            data.push({ ...itemData, id: doc.id });
        });

        this.cache = data;
        this.cacheTimestamp = now;

        return data.slice(0, rowLimit);
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

        // Search within a much larger set (1000) to ensure we find it
        const all = await this.getAllBookings(1000);
        return all.filter(b => {
            const bTruck = this.normalize(b.truck);
            return bTruck.includes(target);
        });
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
