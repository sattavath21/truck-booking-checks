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
        if (rowLimit <= 0) return [];
        const now = Date.now();

        if (!forceRefresh && this.cache && (now - this.cacheTimestamp < this.CACHE_DURATION)) {
            console.log("TruckDB: Returning cached bookings");
            return this.cache.slice(0, rowLimit);
        }

        // const twoDaysAgo = now - (2 * 24 * 60 * 60 * 1000);
        const oneDayAgo = now - (24 * 60 * 60 * 1000);

        try {
            const q = query(
                collection(this.db, COLLECTION_NAME),
                where("timestamp", ">=", oneDayAgo),
                orderBy("timestamp", "desc"),
                limit(rowLimit)
            );

            console.log("TruckDB: Fetching latest from Firestore...");
            const querySnapshot = await getDocs(q);
            const data = [];
            querySnapshot.forEach((doc) => {
                data.push({ ...doc.data(), id: doc.id });
            });

            this.cache = data;
            this.cacheTimestamp = now;
            return data;
        } catch (err) {
            console.error("TruckDB: getAllBookings Error:", err);
            return this.cache || [];
        }
    }

    normalize(text) {
        if (!text) return '';
        return text.toString().toUpperCase()
            .replace(/[^A-Z0-9ก-ฮก-ຮ]/g, '');
    }

    // Generate all searchable substrings of length >= 3
    getFragments(text) {
        const normalized = this.normalize(text);
        if (!normalized) return [];
        const fragments = new Set();

        // Add full normalized text
        fragments.add(normalized);

        // Add all substrings (length 1 and up)
        for (let len = 1; len <= normalized.length; len++) {
            for (let start = 0; start <= normalized.length - len; start++) {
                fragments.add(normalized.substring(start, start + len));
            }
        }

        const result = Array.from(fragments);
        console.log(`TruckDB: Generated ${result.length} fragments for ${normalized}`, result);
        return result;
    }

    async searchPlate(plate) {
        if (!plate) return [];
        const target = this.normalize(plate);
        console.log(`TruckDB: Searching for "${plate}" (Normalized: "${target}")`);

        // If search term is too short, we can't reliably use fragments (they start at length 3)
        // But we can still try if it matches the full plate
        console.log(`TruckDB: Searching Firestore for "${target}"...`);

        try {
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
            const q = query(
                collection(this.db, COLLECTION_NAME),
                where("fragments", "array-contains", target),
                where("timestamp", ">=", oneDayAgo),
                limit(50)
            );

            const querySnapshot = await getDocs(q);
            const matches = [];
            querySnapshot.forEach((doc) => {
                matches.push({ ...doc.data(), id: doc.id });
            });

            console.log(`TruckDB: Found ${matches.length} matches for "${target}"`);
            return matches.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        } catch (err) {
            console.error("TruckDB: Search Query failed:", err);
            // Fallback: If query fails (e.g. index missing), return empty
            return [];
        }
    }

    async findExactBooking(plate) {
        if (!plate) return null;
        const target = this.normalize(plate);

        console.log(`TruckDB: Exact searching for "${target}"...`);
        try {
            const q = query(
                collection(this.db, COLLECTION_NAME),
                where("truck_norm", "==", target),
                limit(1)
            );
            const snapshot = await getDocs(q);
            if (snapshot.empty) return null;
            const doc = snapshot.docs[0];
            return { ...doc.data(), id: doc.id };
        } catch (err) {
            console.error("TruckDB: Exact search failed:", err);
            return null;
        }
    }

    async toggleBookingStatus(id, currentStatus) {
        const newStatus = currentStatus === 'Passed' ? 'Pending' : 'Passed';
        return this.updateBooking(id, { status: newStatus });
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
        if (!dataArray || dataArray.length === 0) {
            console.warn("TruckDB: No data to seed");
            return;
        }
        console.log(`TruckDB: Seeding ${dataArray.length} items to "${COLLECTION_NAME}"...`);
        const BATCH_SIZE = 500;
        for (let i = 0; i < dataArray.length; i += BATCH_SIZE) {
            const batch = writeBatch(this.db);
            const chunk = dataArray.slice(i, i + BATCH_SIZE);
            chunk.forEach(item => {
                const frags = this.getFragments(item.truck);
                const enrichedItem = {
                    ...item,
                    fragments: frags,
                    timestamp: item.timestamp || Date.now()
                };

                // Final check to make sure fragments aren't empty
                if (frags.length === 0) {
                    console.error("TruckDB: Empty fragments generated for:", item.truck);
                }

                const docRef = enrichedItem.id
                    ? doc(this.db, COLLECTION_NAME, enrichedItem.id)
                    : doc(collection(this.db, COLLECTION_NAME));
                batch.set(docRef, enrichedItem);
            });
            await batch.commit();
            console.log(`TruckDB: Committed batch ${Math.floor(i / BATCH_SIZE) + 1}`);
        }
        this.cache = null; // Clear cache after seed
    }

    async syncFromCloud() {
        // Now it's already cloud-first!
        console.log('Using Firestore Cloud Database.');
    }
}

const dbInstance = new TruckDB();
window.truckDB = dbInstance; // Make it accessible globally
