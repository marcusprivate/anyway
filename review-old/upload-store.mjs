const DATABASE_NAME = 'anyway-old-blog-review';
const DATABASE_VERSION = 1;
const STORE_NAME = 'uploads';

let databasePromise;

function requestResult(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
    });
}

export function openUploadStore() {
    if (!('indexedDB' in globalThis)) {
        return Promise.reject(new Error('Deze browser ondersteunt geen lokale afbeeldingsopslag.'));
    }
    if (databasePromise) return databasePromise;

    databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
            const database = request.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('Lokale afbeeldingsopslag kon niet worden geopend.'));
    });
    return databasePromise;
}

async function withStore(mode, action) {
    const database = await openUploadStore();
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const completed = new Promise((resolve, reject) => {
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error || new Error('IndexedDB transaction failed'));
        transaction.onabort = () => reject(transaction.error || new Error('IndexedDB transaction aborted'));
    });
    const result = await action(store);
    await completed;
    return result;
}

export function putUpload(upload) {
    return withStore('readwrite', store => requestResult(store.put(upload)));
}

export function getUpload(uploadId) {
    return withStore('readonly', store => requestResult(store.get(uploadId)));
}

export function deleteUpload(uploadId) {
    return withStore('readwrite', store => requestResult(store.delete(uploadId)));
}

export async function deleteUploads(uploadIds) {
    if (!uploadIds.length) return;
    await withStore('readwrite', async store => {
        await Promise.all(uploadIds.map(uploadId => requestResult(store.delete(uploadId))));
    });
}

export function getAllUploads() {
    return withStore('readonly', store => requestResult(store.getAll()));
}
