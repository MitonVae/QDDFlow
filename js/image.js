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
  await Promise.all(steps.map(async step => {
    const key = step.imageUrl;
    if (key && key.startsWith('idb:') && !_imgUrlCache.has(key)) {
      try {
        const url = await loadImageFromDb(key);
        if (url) _imgUrlCache.set(key, url);
      } catch (e) { /* ignore */ }
    }
  }));
}

/** 读取文件 → 存入 IndexedDB → 更新 step → 刷新渲染 */
function saveImageToStep(file, stepId) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('❌ 请选择图片文件');
    return;
  }
  const reader = new FileReader();
  reader.onload = async ev => {
    const step = STATE.steps.find(s => s.id === stepId);
    if (!step) return;
    const dataUrl = ev.target.result;

    // 删旧图
    if (step.imageUrl && step.imageUrl.startsWith('idb:')) {
      _imgUrlCache.delete(step.imageUrl);
      deleteImageFromDb(step.imageUrl).catch(() => {});
    }

    // 存新图到 IndexedDB，得到引用 key
    let imgKey = dataUrl; // 降级：IndexedDB 失败时直存 base64
    try {
      imgKey = await saveImageToDb(dataUrl);
      _imgUrlCache.set(imgKey, dataUrl); // 同步写入缓存
    } catch (e) {
      console.warn('[saveImageToStep] IndexedDB 存储失败，降级为直存', e);
    }

    step.imageUrl = imgKey;
    step.images   = [imgKey];
    saveAllQdds(); // localStorage 只存 idb: key（几十字节），不会超限

    renderPreview();
    if (_propPanelStepId === stepId) renderStepPanel();
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

  function cleanup() {
    if (document.body.contains(input)) document.body.removeChild(input);
  }

  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (file) saveImageToStep(file, stepId);
    cleanup();
  });
  input.addEventListener('cancel', cleanup);
  setTimeout(cleanup, 30000);
  input.click();
}

// ===== 删除图片 =====
function deleteStepImage(stepId) {
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step) return;
  step.imageUrl = '';
  step.images   = [];
  saveAllQdds();
  renderPreview();
  if (_propPanelStepId === stepId) renderStepPanel();
}

// ===== 图片放大预览 =====
function openImagePreview(src) {
  const old = document.getElementById('img-preview-modal');
  if (old) old.remove();
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
  if (!step) return;

  const dropdown = document.createElement('div');
  dropdown.className = 'type-dropdown-menu';
  TASK_TYPES.forEach(t => {
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

  document.body.appendChild(dropdown);
  const rect = badge.getBoundingClientRect();
  dropdown.style.top  = (rect.bottom + 4) + 'px';
  dropdown.style.left = Math.min(rect.left, window.innerWidth - 160) + 'px';

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
  if (!step) return;
  step.taskType = typeValue;
  step.colorOverride = null;
  saveAllQdds();
  if (STATE.layout === 'table') renderTableLayout();
  else renderTimelineLayout();
  renderStepsList();
}

// ===== 弹窗编辑器图片选择 =====
function editorPickImage() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.cssText = 'position:fixed;top:-9999px;opacity:0;pointer-events:none;';
  document.body.appendChild(input);

  function cleanup() {
    if (document.body.contains(input)) document.body.removeChild(input);
  }

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
