// ===== IndexedDB 图片存储 =====
// 图片以 base64 DataURL 存入 IndexedDB，主数据存储中只保留引用 key（形如 "idb:xxxxx"）。
// 所有操作均为 Promise，调用方可以 await。

const IMG_DB_NAME    = 'qdd_images';
const IMG_DB_VERSION = 1;
const IMG_STORE_NAME = 'images'; // objectStore name

let _imgDb = null; // 缓存已打开的 DB 实例

/** 打开（或复用）ImageDB，返回 Promise<IDBDatabase> */
function openImageDb() {
  if (_imgDb) return Promise.resolve(_imgDb);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IMG_DB_NAME, IMG_DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(IMG_STORE_NAME)) {
        db.createObjectStore(IMG_STORE_NAME); // key-value store, key = imgKey
      }
    };
    req.onsuccess = e => { _imgDb = e.target.result; resolve(_imgDb); };
    req.onerror   = e => reject(e.target.error);
  });
}

/** 存储一张图片，返回 Promise<key>（key = "idb:xxxxxxxx"） */
async function saveImageToDb(dataUrl) {
  const db  = await openImageDb();
  const key = 'idb:' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(IMG_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IMG_STORE_NAME);
    const req   = store.put(dataUrl, key);
    req.onsuccess = () => resolve(key);
    req.onerror   = e => reject(e.target.error);
  });
}

/** 读取一张图片，返回 Promise<dataUrl | null> */
async function loadImageFromDb(key) {
  if (!key || !key.startsWith('idb:')) return key || null; // 兼容旧的 base64 直存
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(IMG_STORE_NAME, 'readonly');
    const store = tx.objectStore(IMG_STORE_NAME);
    const req   = store.get(key);
    req.onsuccess = e => resolve(e.target.result || null);
    req.onerror   = e => reject(e.target.error);
  });
}

/** 删除一张图片（key 为 "idb:..." 时才操作） */
async function deleteImageFromDb(key) {
  if (!key || !key.startsWith('idb:')) return;
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(IMG_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IMG_STORE_NAME);
    const req   = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

/**
 * 将某个 step 的旧 base64 imageUrl 迁移到 IndexedDB。
 * 如果 imageUrl 已经是 "idb:" 引用或为空，则跳过。
 * 迁移后修改 step.imageUrl 为新 key，并更新 DOM 显示。
 */
async function migrateStepImageToDb(step) {
  const url = step.imageUrl;
  if (!url || url.startsWith('idb:')) return false; // 已迁移或无图
  try {
    const key = await saveImageToDb(url);
    step.imageUrl = key;
    if (Array.isArray(step.images)) {
      step.images = step.images.map(u => (u === url ? key : u));
    }
    return true;
  } catch (e) {
    console.warn('[migrateStepImageToDb] 迁移失败', e);
    return false;
  }
}

/**
 * 应用启动时，把 localStorage 里所有残存的 base64 图片全部迁移到 IndexedDB。
 * 迁移完成后重新保存 localStorage（不含 base64，只含 idb: key）。
 */
async function migrateAllImagesToDb() {
  let changed = false;
  for (const qdd of STORE.qdds) {
    for (const step of (qdd.steps || [])) {
      if (step.imageUrl && !step.imageUrl.startsWith('idb:')) {
        const ok = await migrateStepImageToDb(step);
        if (ok) changed = true;
      }
    }
  }
  if (changed) saveAllQdds();
}

/**
 * 从 IndexedDB 解析 step 的 imageUrl 为真实 DataURL，
 * 仅用于渲染（不修改 step.imageUrl）。
 * 如果 imageUrl 不是 "idb:" 开头，直接返回原值。
 */
async function resolveStepImageUrl(step) {
  const key = step.imageUrl;
  if (!key || !key.startsWith('idb:')) return key || '';
  return (await loadImageFromDb(key)) || '';
}
