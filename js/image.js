// ===== 图片核心：读取文件 → base64 → 存 IndexedDB → 存入 step → 刷新 =====

// 内存缓存：idb:key → dataUrl（会话期间有效，刷新后由 _preloadStepImages 重填）
const _imgUrlCache = new Map();

/** 根据 imageUrl 返回可直接用于 <img src> 的 DataURL */
function getResolvedImageUrl(imageUrl) {
  if (!imageUrl || imageUrl === '__img__') return '';
  if (imageUrl.startsWith('idb:')) return _imgUrlCache.get(imageUrl) || '';
  return imageUrl; // 兼容旧版直存的 base64
}

/**
 * 预热图片缓存：把当前 QDD 所有 idb: key 从 IndexedDB 读出来存入 _imgUrlCache。
 * 必须在 renderAll/renderPreview 之前 await。
 */
async function _preloadStepImages() {
  const steps = STATE.steps || [];
  const toLoad = steps.filter(s => s.imageUrl && s.imageUrl.startsWith('idb:') && !_imgUrlCache.has(s.imageUrl));
  if (toLoad.length === 0) return;

  log.debug(`_preloadStepImages: 加载 ${toLoad.length} 张图片`);
  await Promise.all(toLoad.map(async step => {
    try {
      const url = await loadImageFromDb(step.imageUrl);
      if (url) _imgUrlCache.set(step.imageUrl, url);
      else log.warn('_preloadStepImages: 图片不存在于 IndexedDB', step.id, step.imageUrl.slice(0, 20));
    } catch (e) {
      log.error('_preloadStepImages: 加载失败', step.id, e);
    }
  }));
  log.debug(`_preloadStepImages: 完成，缓存共 ${_imgUrlCache.size} 张`);
}

/** 读取文件 → 存入 IndexedDB → 更新 step → 刷新渲染 */
function saveImageToStep(file, stepId) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('❌ 请选择图片文件');
    return;
  }
  log.info('saveImageToStep: 开始处理', stepId, file.name, file.size);
  const reader = new FileReader();
  reader.onload = async ev => {
    const step = STATE.steps.find(s => s.id === stepId);
    if (!step) {
      log.error('saveImageToStep: 找不到 step', stepId);
      showToast('❌ 找不到对应环节');
      return;
    }
    const dataUrl = ev.target.result;

    // 删旧图
    if (step.imageUrl && step.imageUrl.startsWith('idb:')) {
      _imgUrlCache.delete(step.imageUrl);
      deleteImageFromDb(step.imageUrl).catch(e => log.warn('删旧图失败', e));
    }

    // 存新图到 IndexedDB
    let imgKey = dataUrl; // 降级：IndexedDB 失败时直存 base64（不持久化但能显示）
    try {
      imgKey = await saveImageToDb(dataUrl);
      _imgUrlCache.set(imgKey, dataUrl);
      log.info('saveImageToStep: 图片已存入 IndexedDB', imgKey.slice(0, 20));
    } catch (e) {
      log.warn('saveImageToStep: IndexedDB 存储失败，降级为内存存储', e);
    }

    step.imageUrl = imgKey;
    step.images   = [imgKey];
    saveAllQdds();
    renderPreview();
    if (_propPanelStepId === stepId) renderStepPanel();
  };
  reader.onerror = e => {
    log.error('saveImageToStep: 文件读取失败', e);
    showToast('❌ 图片读取失败');
  };
  reader.readAsDataURL(file);
}

// ===== 点击选文件 =====
function pickStepImage(stepId) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.cssText = 'position:fixed;top:-9999px;opacity:0;pointer-events:none;';
  document.body.appendChild(input);

  const cleanup = () => {
    if (document.body.contains(input)) document.body.removeChild(input);
  };

  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (file) saveImageToStep(file, stepId);
    cleanup();
  });
  input.addEventListener('cancel', cleanup);
  setTimeout(cleanup, 30000);
  input.click();
  log.debug('pickStepImage: 文件选择框已打开', stepId);
}

// ===== 删除图片 =====
function deleteStepImage(stepId) {
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step) { log.warn('deleteStepImage: 找不到 step', stepId); return; }

  if (step.imageUrl && step.imageUrl.startsWith('idb:')) {
    _imgUrlCache.delete(step.imageUrl);
    deleteImageFromDb(step.imageUrl).catch(e => log.warn('deleteStepImage: IndexedDB 删除失败', e));
  }
  step.imageUrl = '';
  step.images   = [];
  saveAllQdds();
  renderPreview();
  if (_propPanelStepId === stepId) renderStepPanel();
  log.info('deleteStepImage:', stepId);
}

// ===== 图片放大预览 =====
function openImagePreview(src) {
  const old = document.getElementById('img-preview-modal');
  if (old) old.remove();
  if (!src) { log.warn('openImagePreview: 空 src'); return; }
  const modal = document.createElement('div');
  modal.id = 'img-preview-modal';
  modal.innerHTML = `
    <div class="img-preview-backdrop">
      <img class="img-preview-img" src="${esc(src)}" alt="预览">
      <div class="img-preview-hint">点击任意处关闭</div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', () => modal.remove());
  const onKey = e => {
    if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', onKey); }
  };
  document.addEventListener('keydown', onKey);
}

// ===== 任务类型内联下拉 =====
let _typeDropdownCleanup = null;

function toggleTypeDropdown(event, stepId) {
  event.stopPropagation();
  closeTypeDropdown();
  const badge = event.currentTarget;
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step) { log.warn('toggleTypeDropdown: 找不到 step', stepId); return; }

  const dropdown = document.createElement('div');
  dropdown.className = 'type-dropdown-menu';

  // 渲染所有类型选项（内置 + 自定义）
  getTaskTypes().forEach(t => {
    const item = document.createElement('div');
    item.className = 'type-dropdown-item' + (step.taskType === t.value ? ' active' : '');
    const dot = t.color
      ? `<span class="type-dd-dot" style="background:${t.color}"></span>`
      : `<span class="type-dd-dot type-dd-dot-empty"></span>`;
    item.innerHTML = `${dot}<span>${t.label}</span>`;
    item.addEventListener('click', e => {
      e.stopPropagation();
      setStepTaskType(stepId, t.value);
      closeTypeDropdown();
    });
    dropdown.appendChild(item);
  });

  // 分隔线
  const sep = document.createElement('div');
  sep.className = 'type-dropdown-sep';
  dropdown.appendChild(sep);

  // 「＋ 添加自定义类型」
  const addItem = document.createElement('div');
  addItem.className = 'type-dropdown-item type-dropdown-add';
  addItem.textContent = '＋ 添加自定义类型…';
  addItem.addEventListener('click', e => {
    e.stopPropagation();
    closeTypeDropdown();
    promptAddCustomTaskType(stepId);
  });
  dropdown.appendChild(addItem);

  // 「✏️ 管理自定义类型」（有自定义时显示）
  if (STORE.customTaskTypes.length > 0) {
    const manageItem = document.createElement('div');
    manageItem.className = 'type-dropdown-item type-dropdown-manage';
    manageItem.textContent = '🗑 管理自定义类型…';
    manageItem.addEventListener('click', e => {
      e.stopPropagation();
      closeTypeDropdown();
      openManageCustomTaskTypes();
    });
    dropdown.appendChild(manageItem);
  }

  document.body.appendChild(dropdown);
  const rect = badge.getBoundingClientRect();
  dropdown.style.top  = (rect.bottom + 4) + 'px';
  dropdown.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';

  const onOutside = () => closeTypeDropdown();
  setTimeout(() => document.addEventListener('click', onOutside, { once: true }), 0);
  _typeDropdownCleanup = () => {
    document.removeEventListener('click', onOutside);
    if (dropdown.parentNode) dropdown.parentNode.removeChild(dropdown);
    _typeDropdownCleanup = null;
  };
}

function closeTypeDropdown() {
  if (_typeDropdownCleanup) _typeDropdownCleanup();
}

function setStepTaskType(stepId, typeValue) {
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step) { log.warn('setStepTaskType: 找不到 step', stepId); return; }
  step.taskType = typeValue;
  step.colorOverride = null;
  saveAllQdds();
  if (STATE.layout === 'table') renderTableLayout();
  else renderTimelineLayout();
  renderStepsList();
  log.info('setStepTaskType:', stepId, typeValue);
}

// ===== 弹窗编辑器图片选择 =====
function editorPickImage() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.cssText = 'position:fixed;top:-9999px;opacity:0;pointer-events:none;';
  document.body.appendChild(input);

  const cleanup = () => {
    if (document.body.contains(input)) document.body.removeChild(input);
  };

  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => {
        const src = ev.target.result;
        const efImage = document.getElementById('ef-image');
        if (efImage) efImage.value = src;
        const preview = document.getElementById('ef-image-preview');
        if (preview) preview.innerHTML = `<img src="${src}" alt="预览">`;
        const clearBtn = document.getElementById('ef-image-clear');
        if (clearBtn) clearBtn.style.display = '';
      };
      reader.readAsDataURL(file);
    }
    cleanup();
  });
  input.addEventListener('cancel', cleanup);
  setTimeout(cleanup, 30000);
  input.click();
}

function editorClearImage() {
  const efImage = document.getElementById('ef-image');
  if (efImage) efImage.value = '';
  const preview = document.getElementById('ef-image-preview');
  if (preview) preview.innerHTML = '<span class="image-upload-hint">📷 尚未添加配图</span>';
  const clearBtn = document.getElementById('ef-image-clear');
  if (clearBtn) clearBtn.style.display = 'none';
}

/**
 * 弹窗编辑器打开时，如果 step.imageUrl 是 idb: key，
 * 需要异步解析为真实 dataUrl 才能在 <img> 里预览。
 * 在 openStepEditor 之后调用此函数刷新预览区。
 */
async function refreshEditorImagePreview(imageUrl) {
  if (!imageUrl) return;
  let src = imageUrl;
  if (imageUrl.startsWith('idb:')) {
    src = _imgUrlCache.get(imageUrl) || await loadImageFromDb(imageUrl).catch(() => null) || '';
    if (!src) { log.warn('refreshEditorImagePreview: 无法加载图片', imageUrl.slice(0, 20)); return; }
    _imgUrlCache.set(imageUrl, src); // 顺便更新缓存
  }
  const efImage  = document.getElementById('ef-image');
  const preview  = document.getElementById('ef-image-preview');
  const clearBtn = document.getElementById('ef-image-clear');
  if (efImage)  efImage.value = src;
  if (preview)  preview.innerHTML = `<img src="${esc(src)}" alt="预览">`;
  if (clearBtn) clearBtn.style.display = '';
}

// ===== 自定义任务类型管理 =====

// 从下拉菜单触发，弹出 prompt 添加新自定义类型
function promptAddCustomTaskType(stepId) {
  const label = prompt('请输入自定义类型名称（如：CUT 过场）：', '');
  if (!label || !label.trim()) return;
  const trimmed = label.trim();

  // 取一个随机颜色
  const color = PRESET_COLORS[STORE.customTaskTypes.length % PRESET_COLORS.length];
  const value = 'CUSTOM_' + trimmed.replace(/\s+/g, '_').toUpperCase().slice(0, 20);

  // 防止 value 重复
  if (getTaskTypes().some(t => t.value === value)) {
    showToast('⚠️ 已存在同名类型');
    return;
  }

  STORE.customTaskTypes.push({ value, label: trimmed, color });
  saveCustomCategories();
  log.info('promptAddCustomTaskType: 新增', value, trimmed);

  // 如果提供了 stepId，则立即将该步骤设为新类型
  if (stepId) setStepTaskType(stepId, value);
  else showToast(`✅ 已添加类型「${trimmed}」`);
}

// 弹窗管理（删除）已有的自定义类型
function openManageCustomTaskTypes() {
  const old = document.getElementById('manage-custom-modal');
  if (old) old.remove();

  if (STORE.customTaskTypes.length === 0) {
    showToast('暂无自定义类型');
    return;
  }

  const rows = STORE.customTaskTypes.map((t, i) => `
    <div class="manage-custom-row" data-index="${i}">
      <span class="type-dd-dot" style="background:${t.color}"></span>
      <span class="manage-custom-label">${esc(t.label)}</span>
      <button class="manage-custom-del" onclick="deleteCustomTaskType(${i})">删除</button>
    </div>`).join('');

  const modal = document.createElement('div');
  modal.id = 'manage-custom-modal';
  modal.className = 'manage-custom-backdrop';
  modal.innerHTML = `
    <div class="manage-custom-box">
      <div class="manage-custom-title">管理自定义任务类型</div>
      <div class="manage-custom-list">${rows}</div>
      <button class="manage-custom-close" onclick="document.getElementById('manage-custom-modal').remove()">关闭</button>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function deleteCustomTaskType(index) {
  const t = STORE.customTaskTypes[index];
  if (!t) return;
  if (!confirm(`确认删除自定义类型「${t.label}」？已使用该类型的环节将失去颜色标记。`)) return;

  // 将使用该类型的所有环节 taskType 清空
  STORE.qdds.forEach(qdd => {
    (qdd.steps || []).forEach(s => { if (s.taskType === t.value) s.taskType = ''; });
  });

  STORE.customTaskTypes.splice(index, 1);
  saveCustomCategories();
  saveAllQdds();
  log.info('deleteCustomTaskType:', t.value);

  // 刷新管理弹窗
  document.getElementById('manage-custom-modal')?.remove();
  if (STORE.customTaskTypes.length > 0) openManageCustomTaskTypes();

  renderAll();
  showToast(`已删除类型「${t.label}」`);
}

// ===== 自定义触发方式管理 =====

function promptAddCustomTrigger(onAdded) {
  const label = prompt('请输入自定义触发方式（如：NPC对话触发）：', '');
  if (!label || !label.trim()) return;
  const trimmed = label.trim();

  if (getTriggerOptions().includes(trimmed)) {
    showToast('⚠️ 该触发方式已存在');
    return;
  }

  STORE.customTriggers.push(trimmed);
  saveCustomCategories();
  log.info('promptAddCustomTrigger: 新增', trimmed);
  showToast(`✅ 已添加触发方式「${trimmed}」`);
  if (typeof onAdded === 'function') onAdded(trimmed);
}

function openManageCustomTriggers() {
  const old = document.getElementById('manage-trigger-modal');
  if (old) old.remove();

  if (STORE.customTriggers.length === 0) {
    showToast('暂无自定义触发方式');
    return;
  }

  const rows = STORE.customTriggers.map((t, i) => `
    <div class="manage-custom-row" data-index="${i}">
      <span class="manage-custom-label">${esc(t)}</span>
      <button class="manage-custom-del" onclick="deleteCustomTrigger(${i})">删除</button>
    </div>`).join('');

  const modal = document.createElement('div');
  modal.id = 'manage-trigger-modal';
  modal.className = 'manage-custom-backdrop';
  modal.innerHTML = `
    <div class="manage-custom-box">
      <div class="manage-custom-title">管理自定义触发方式</div>
      <div class="manage-custom-list">${rows}</div>
      <button class="manage-custom-close" onclick="document.getElementById('manage-trigger-modal').remove()">关闭</button>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function deleteCustomTrigger(index) {
  const t = STORE.customTriggers[index];
  if (!t) return;
  if (!confirm(`确认删除触发方式「${t}」？`)) return;
  STORE.customTriggers.splice(index, 1);
  saveCustomCategories();
  log.info('deleteCustomTrigger:', t);

  document.getElementById('manage-trigger-modal')?.remove();
  if (STORE.customTriggers.length > 0) openManageCustomTriggers();

  showToast(`已删除触发方式「${t}」`);
}
