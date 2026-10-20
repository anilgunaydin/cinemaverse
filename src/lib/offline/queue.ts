"use client";

/**
 * IndexedDB wrapper for offline action queue
 * Stores pending library mutations when offline
 */

const DB_NAME = "cinemaverse-offline";
const DB_VERSION = 1;
const STORE_NAME = "pendingActions";

type PendingAction = {
  id: string;
  type: "library_add" | "library_update" | "library_delete" | "rating" | "status";
  payload: any;
  timestamp: number;
  retries: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("type", "type", { unique: false });
      }
    };
  });

  return dbPromise;
}

export async function queueAction(
  type: PendingAction["type"],
  payload: any
): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const action: PendingAction = {
    id,
    type,
    payload,
    timestamp: Date.now(),
    retries: 0,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).add(action);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Register sync if supported
  if ("serviceWorker" in navigator && "sync" in window.ServiceWorkerRegistration.prototype) {
    try {
      const registration = await navigator.serviceWorker.ready;
      // @ts-expect-error - sync is not in TypeScript lib but exists in browsers
      await registration.sync.register("sync-library");
    } catch {
      // sync not supported or already registered
    }
  }

  return id;
}

export async function getPendingActions(): Promise<PendingAction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removeAction(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function incrementRetry(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const action = getReq.result;
      if (action) {
        action.retries += 1;
        store.put(action);
      }
      resolve();
    };
    getReq.onerror = () => reject(getReq.error);
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllActions(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Helper functions for common library operations
export async function queueLibraryAdd(
  titleId: string,
  status: string,
  rating?: number
) {
  return queueAction("library_add", { titleId, status, rating });
}

export async function queueLibraryUpdate(
  entryId: string,
  updates: Record<string, any>
) {
  return queueAction("library_update", { entryId, updates });
}

export async function queueLibraryDelete(entryId: string) {
  return queueAction("library_delete", { entryId });
}

export async function queueRating(titleId: string, rating: number) {
  return queueAction("rating", { titleId, rating });
}

export async function queueStatusChange(titleId: string, status: string) {
  return queueAction("status", { titleId, status });
}