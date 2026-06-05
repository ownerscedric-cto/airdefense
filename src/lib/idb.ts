// 작은 IndexedDB 래퍼. 의존성 없음.
const DB_NAME = "air-defence";
const DB_VERSION = 1;
export const ASSETS_STORE = "assets";

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ASSETS_STORE)) {
        const store = db.createObjectStore(ASSETS_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
        store.createIndex("kind", "kind");
        store.createIndex("jobId", "jobId");
      }
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
  return dbPromise;
}

function tx(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  store = ASSETS_STORE
): IDBObjectStore {
  return db.transaction(store, mode).objectStore(store);
}

function reqAsPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPut<T>(value: T, store = ASSETS_STORE): Promise<void> {
  const db = await openDB();
  await reqAsPromise(tx(db, "readwrite", store).put(value));
}

export async function idbGet<T>(
  id: string,
  store = ASSETS_STORE
): Promise<T | undefined> {
  const db = await openDB();
  return reqAsPromise(tx(db, "readonly", store).get(id) as IDBRequest<T | undefined>);
}

export async function idbDelete(id: string, store = ASSETS_STORE): Promise<void> {
  const db = await openDB();
  await reqAsPromise(tx(db, "readwrite", store).delete(id));
}

export async function idbAll<T>(store = ASSETS_STORE): Promise<T[]> {
  const db = await openDB();
  return reqAsPromise(tx(db, "readonly", store).getAll() as IDBRequest<T[]>);
}
