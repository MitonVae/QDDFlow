// ===== 图片核心：读取文件 → base64 → 存入 step → 刷新 =====

function saveImageToStep(file, stepId) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('❌ 请选择图片文件');
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => {
    const step = STATE.steps.find(s => s.id === stepId);
    if (!step) return;
    step.imageUrl = ev.target.result;
    step.images   = [step.imageUrl];
    saveAllQdds();
    renderPreview();
    if (_propPanelStepId === stepId) renderStepPanel();
  };
  reader.readAsDataURL(file);
}

/** 返回可用于 <img src> 的 URL（兼容旧 idb: 引用，直接返回空） */
function getResolvedImageUrl(imageUrl) {
  if (!imageUrl) return '';
  if (imageUrl.startsWith('idb:') || imageUrl === '__img__') return '';
  return imageUrl;
}

/** 无操作，保持调用兼容 */
function _preloadStepImages() {
  return Promise.resolve();
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
