// ===== IndexedDB 图片存储（已停用，保留 stub 避免调用报错）=====
// 图片现在直接以 base64 存入 localStorage，不再使用 IndexedDB。

function openImageDb()              { return Promise.resolve(null); }
function saveImageToDb(dataUrl)     { return Promise.resolve(dataUrl); }
function loadImageFromDb(key)       { return Promise.resolve(key); }
function deleteImageFromDb(key)     { return Promise.resolve(); }
function migrateStepImageToDb(step) { return Promise.resolve(false); }
function migrateAllImagesToDb()     { return Promise.resolve(); }
function resolveStepImageUrl(step)  { return Promise.resolve(step.imageUrl || ''); }
