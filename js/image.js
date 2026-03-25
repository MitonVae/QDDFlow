// ===== 图片核心：读取文件 → base64 → 存入 step → 刷新 =====

/**
 * 把文件读成 base64，存入 step.imageUrl，然后刷新预览和面板。
 * 这是唯一的图片写入入口，所有来源（拖拽/点击选择/面板）都走这里。
 */
function saveImageToStep(file, stepId) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('❌ 请选择图片文件');
    return;
  }
  const reader = new FileReader();
  reader.onload = async ev => {
    const step = STATE.steps.find(s => s.id === stepId);
    if (!step) {
      console.warn('[saveImageToStep] step not found, stepId=', stepId);
      showToast('❌ 找不到对应环节');
      return;
    }
    const dataUrl = ev.target.result;

    // 删除旧图片（如果是 idb 引用）
    if (step.imageUrl && step.imageUrl.startsWith('idb:')) {
      deleteImageFromDb(step.imageUrl).catch(() => {});
    }

    // 将新图片存入 IndexedDB，只在 step 里保存引用 key
    let imgKey = dataUrl; // 默认直存（兜底）
    try {
      imgKey = await saveImageToDb(dataUrl);
    } catch (e) {
      console.warn('[saveImageToStep] IndexedDB 存储失败，降级为内存存储', e);
    }

    step.imageUrl = imgKey;
    step.images   = [imgKey];
    saveAllQdds(); // localStorage 里只存 key，不含 base64

    // 渲染时需要真实 URL，先把 step 的 img 解析出来再刷新
    _renderPreviewWithImages();
    if (_propPanelStepId === stepId) _renderStepPanelWithImages();
  };
  reader.readAsDataURL(file);
}

// ===== 图片 URL 解析缓存（idb:key → dataUrl） =====
// 渲染前填充，渲染函数通过 getResolvedImageUrl() 获取真实 URL
const _imgUrlCache = new Map();

/** 批量把所有 step 的 idb: key 解析为 dataUrl，存入缓存 */
async function _preloadStepImages() {
  const steps = STATE.steps || [];
  await Promise.all(steps.map(async step => {
    const key = step.imageUrl;
    if (key && key.startsWith('idb:') && !_imgUrlCache.has(key)) {
      const url = await loadImageFromDb(key).catch(() => null);
      if (url) _imgUrlCache.set(key, url);
    }
  }));
}

/** 根据 imageUrl（可能是 idb: key 或 dataUrl）返回可用于 <img src> 的 URL */
function getResolvedImageUrl(imageUrl) {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('idb:')) return _imgUrlCache.get(imageUrl) || '';
  return imageUrl; // 旧 base64 直接用
}

/** 预加载图片后渲染预览 */
async function _renderPreviewWithImages() {
  await _preloadStepImages();
  renderPreview();
}

/** 预加载图片后渲染属性面板 */
async function _renderStepPanelWithImages() {
  await _preloadStepImages();
  renderStepPanel();
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

  // cancel 事件（现代浏览器支持，用户点取消时触发）
  input.addEventListener('cancel', cleanup);

  // 兜底：30s 后无论如何清理（防止内存泄漏）
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

// ===== 绑定预览区图片格的拖拽和点击事件（每次渲染后调用）=====
function bindPreviewImageZones(container) {
  container.querySelectorAll('.qt-img-zone').forEach(zone => {
    const stepId = zone.dataset.stepId;
    if (!stepId) return;

    // 拖入图片
    zone.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      zone.classList.add('qt-img-drop-hover');
    });
    zone.addEventListener('dragleave', e => {
      // 只在真正离开格子时清除（避免子元素触发误清除）
      if (!zone.contains(e.relatedTarget)) {
        zone.classList.remove('qt-img-drop-hover');
      }
    });
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('qt-img-drop-hover');
      const file = e.dataTransfer.files[0];
      if (file) saveImageToStep(file, stepId);
    });

    // 注意：点击事件已由 HTML 内联 onclick="pickStepImage(...)" 处理，
    // 此处仅处理删除按钮的 stopPropagation，避免重复弹框。
    zone.addEventListener('click', e => {
      if (e.target.closest('.qt-img-del-btn')) e.stopPropagation();
    });
  });
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
