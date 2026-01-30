const DB_NAME = 'TMGT_Database';
const STORE_NAME = 'LogisticsData';

class TruckDB {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 2); // Bump version for new fields
            request.onerror = () => reject('Database error');
            request.onsuccess = (e) => {
                this.db = e.target.result;
                resolve(this.db);
            };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
        });
    }

    async getAllBookings() {
        return new Promise((resolve) => {
            const tx = this.db.transaction(STORE_NAME, 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => {
                // Return all bookings, sorted by timestamp descending
                const data = request.result || [];
                resolve(data.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
            };
        });
    }

    normalize(text) {
        if (!text) return '';
        // Remove spaces, dots, dashes, and other special characters
        // Keep letters (English, Thai, Lao) and numbers
        return text.toString().toUpperCase()
            .replace(/[^A-Z0-9ก-ฮກ-ຮ]/g, '');
    }

    async searchPlate(plate) {
        if (!plate) return null;
        const target = this.normalize(plate);
        const all = await this.getAllBookings();
        return all.find(b => {
            const bTruck = this.normalize(b.truck);
            return bTruck === target;
        });
    }

    async clearAll() {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject('Clear failed');
        });
    }

    async addBooking(item) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            store.put(item);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject('Add failed');
        });
    }

    async seedData(dataArray) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(STORE_NAME, 'readwrite');
            const store = tx.objectStore(STORE_NAME);
            dataArray.forEach(item => store.put(item));
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject('Seeding failed');
        });
    }

    // This makes it easy to switch to a Cloud DB later
    async syncFromCloud() {
        console.log('Cloud sync not implemented yet. Using Local Storage.');
    }
}

const dbInstance = new TruckDB();
window.truckDB = dbInstance; // Make it accessible globally
