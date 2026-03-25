// ===== IndexedDB 图片存储 =====
// 图片以 base64 DataURL 存入 IndexedDB，主数据只保留 "idb:xxxxx" 引用 key。
const IMG_DB_NAME    = 'qdd_images';
const IMG_DB_VERSION = 1;
const IMG_STORE_NAME = 'images';

let _imgDb = null;

function openImageDb() {
  if (_imgDb) return Promise.resolve(_imgDb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IMG_DB_NAME, IMG_DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IMG_STORE_NAME)) {
        db.createObjectStore(IMG_STORE_NAME);
      }
    };
    req.onsuccess = e => { _imgDb = e.target.result; resolve(_imgDb); };
    req.onerror   = e => reject(e.target.error);
  });
}

/** 存一张图片，返回 Promise<"idb:xxxxx"> */
async function saveImageToDb(dataUrl) {
  const db  = await openImageDb();
  const key = 'idb:' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(IMG_STORE_NAME, 'readwrite');
    tx.objectStore(IMG_STORE_NAME).put(dataUrl, key);
    tx.oncomplete = () => resolve(key);
    tx.onerror    = e => reject(e.target.error);
  });
}

/** 读一张图片，返回 Promise<dataUrl | null> */
async function loadImageFromDb(key) {
  if (!key || !key.startsWith('idb:')) return key || null;
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(IMG_STORE_NAME, 'readonly');
    const req = tx.objectStore(IMG_STORE_NAME).get(key);
    req.onsuccess = e => resolve(e.target.result || null);
    req.onerror   = e => reject(e.target.error);
  });
}

/** 删一张图片 */
async function deleteImageFromDb(key) {
  if (!key || !key.startsWith('idb:')) return;
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMG_STORE_NAME, 'readwrite');
    tx.objectStore(IMG_STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror    = e => reject(e.target.error);
  });
}

/** 把 STORE.qdds 里所有残存的 base64 imageUrl 迁移到 IndexedDB（一次性） */
async function migrateAllImagesToDb() {
  let changed = false;
  for (const qdd of STORE.qdds) {
    for (const step of (qdd.steps || [])) {
      if (step.imageUrl && !step.imageUrl.startsWith('idb:')) {
        try {
          const key = await saveImageToDb(step.imageUrl);
          step.imageUrl = key;
          step.images   = [key];
          changed = true;
        } catch (e) {
          console.warn('[migrateAllImagesToDb] 迁移失败', e);
        }
      }
    }
  }
  if (changed) saveAllQdds();
}