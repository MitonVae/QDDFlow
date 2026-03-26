// ===== IndexedDB 图片存储 =====
// step.imageUrl 存 "idb:xxxxx" 引用 key，图片 base64 存 IndexedDB。
// 好处：localStorage 只存几十字节的 key，不会超配额；图片数据量不受限制。
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
        log.info('openImageDb: objectStore 已创建');
      }
    };
    req.onsuccess = e => {
      _imgDb = e.target.result;
      log.debug('openImageDb: 连接成功');
      resolve(_imgDb);
    };
    req.onerror = e => {
      log.error('openImageDb: 打开失败', e.target.error);
      reject(e.target.error);
    };
  });
}

/** 存一张图片，返回 Promise<"idb:xxxxx"> */
async function saveImageToDb(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    throw new Error('saveImageToDb: 无效的 dataUrl');
  }
  const db  = await openImageDb();
  const key = 'idb:' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMG_STORE_NAME, 'readwrite');
    tx.objectStore(IMG_STORE_NAME).put(dataUrl, key);
    tx.oncomplete = () => { log.debug('saveImageToDb: 存储成功', key.slice(0, 20)); resolve(key); };
    tx.onerror    = e => { log.error('saveImageToDb: 存储失败', e.target.error); reject(e.target.error); };
  });
}

/** 读一张图片，返回 Promise<dataUrl | null> */
async function loadImageFromDb(key) {
  if (!key) return null;
  if (!key.startsWith('idb:')) return key; // 兼容旧 base64 直存
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(IMG_STORE_NAME, 'readonly');
    const req = tx.objectStore(IMG_STORE_NAME).get(key);
    req.onsuccess = e => {
      const result = e.target.result || null;
      if (!result) log.warn('loadImageFromDb: key 不存在', key.slice(0, 20));
      resolve(result);
    };
    req.onerror = e => { log.error('loadImageFromDb: 读取失败', key, e.target.error); reject(e.target.error); };
  });
}

/** 删一张图片（仅 idb: 开头的 key 才操作） */
async function deleteImageFromDb(key) {
  if (!key || !key.startsWith('idb:')) return;
  const db = await openImageDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMG_STORE_NAME, 'readwrite');
    tx.objectStore(IMG_STORE_NAME).delete(key);
    tx.oncomplete = () => { log.debug('deleteImageFromDb: 删除成功', key.slice(0, 20)); resolve(); };
    tx.onerror    = e => { log.error('deleteImageFromDb: 删除失败', key, e.target.error); reject(e.target.error); };
  });
}

/**
 * 启动时一次性迁移：把 STORE.qdds 里所有残存的 base64 imageUrl 存入 IndexedDB。
 * 迁移完成后重新 saveAllQdds（只存 idb: key，体积很小）。
 */
async function migrateAllImagesToDb() {
  let count = 0;
  for (const qdd of STORE.qdds) {
    for (const step of (qdd.steps || [])) {
      if (step.imageUrl && !step.imageUrl.startsWith('idb:') && step.imageUrl.startsWith('data:')) {
        try {
          const key = await saveImageToDb(step.imageUrl);
          step.imageUrl = key;
          step.images   = [key];
          count++;
        } catch (e) {
          log.warn('migrateAllImagesToDb: 迁移某步骤图片失败', step.id, e);
        }
      }
    }
  }
  if (count > 0) {
    saveAllQdds();
    log.info(`migrateAllImagesToDb: 迁移完成，共 ${count} 张图片`);
  } else {
    log.debug('migrateAllImagesToDb: 无需迁移');
  }
}