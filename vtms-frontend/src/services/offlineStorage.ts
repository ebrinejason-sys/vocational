/**
 * Simple IndexedDB wrapper for offline-first NGO operations.
 * Allows field staff to capture attendance and case notes without internet.
 */

const DB_NAME = 'VTMS_OFFLINE_DB';
const DB_VERSION = 1;

export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('attendance_sync_queue')) {
        db.createObjectStore('attendance_sync_queue', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('case_notes_sync_queue')) {
        db.createObjectStore('case_notes_sync_queue', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const saveOfflineEntry = async (storeName: string, data: any) => {
  const db: any = await initDB();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  store.add({ ...data, timestamp: new Date().toISOString() });
  return tx.complete;
};
