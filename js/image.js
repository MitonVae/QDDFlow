// ===== Inline Image Upload =====
let _inlineImgTargetId = null;
let _inlineImgTargetMode = 'preview'; // 'preview' | 'panel'

/** 每次调用都创建全新的 file input，彻底避免 value 清空无效、change 不触发的问题 */
function _openImageFilePicker(stepId, mode) {
  _inlineImgTargetId = stepId;
  _inlineImgTargetMode = mode;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (file) readInlineImageFile(file, _inlineImgTargetId);
    if (document.body.contains(input)) document.body.removeChild(input);
  });
  // 用户取消选择时（focus 回到 window）也要销毁 input
  window.addEventListener('focus', function onFocus() {
    setTimeout(() => {
      if (document.body.contains(input)) document.body.removeChild(input);
    }, 500);
    window.removeEventListener('focus', onFocus);
  }, { once: true });

  input.click();
}

function triggerInlineImageSelect(stepId) {
  _openImageFilePicker(stepId, 'preview');
}

function readInlineImageFile(file, stepId) {
  const reader = new FileReader();
  reader.onload = e => {
    const step = STATE.steps.find(s => s.id === stepId);
    if (!step) return;
    const dataUrl = e.target.result;

    if (_inlineImgTargetMode === 'panel') {
      // Add to images array
      if (!step.images) step.images = step.imageUrl ? [step.imageUrl] : [];
      step.images.push(dataUrl);
      step.imageUrl = step.images[0]; // keep legacy in sync
      saveAllQdds();
      renderStepPanel(); // refresh panel thumbnail list
      renderPreview();
      return;
    }

    // Inline mode: always append the new image (drag/paste into the image zone)
    if (!step.images) step.images = step.imageUrl ? [step.imageUrl] : [];
    step.images.push(dataUrl);
    step.imageUrl = step.images[0]; // keep legacy in sync
    saveAllQdds();
    if (STATE.layout === 'table') renderTableLayout();
    else renderTimelineLayout();
  };
  reader.readAsDataURL(file);
}

// Track which image zone is focused (for Ctrl+V)
let _focusedImgZoneId = null;
let _focusedImgZoneMode = null; // 'panel' | 'preview' | null

// ── Image zone drag-drop: delegated on document (survives re-renders) ──
let _imgDragTargetZone = null;

function _initImageZoneDelegation() {
  document.addEventListener('dragover', e => {
    const zone = e.target.closest('.qt-img-multi-wrap');
    if (!zone) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (_imgDragTargetZone !== zone) {
      if (_imgDragTargetZone) _imgDragTargetZone.classList.remove('qt-img-drop-hover');
      _imgDragTargetZone = zone;
      zone.classList.add('qt-img-drop-hover');
    }
  });

  document.addEventListener('dragleave', e => {
    const zone = e.target.closest('.qt-img-multi-wrap');
    if (!zone || zone !== _imgDragTargetZone) return;
    // Only clear if leaving the zone entirely (relatedTarget is outside)
    if (!zone.contains(e.relatedTarget)) {
      zone.classList.remove('qt-img-drop-hover');
      _imgDragTargetZone = null;
    }
  });

  document.addEventListener('drop', e => {
    const zone = e.target.closest('.qt-img-multi-wrap');
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove('qt-img-drop-hover');
    _imgDragTargetZone = null;
    const stepId = zone.dataset.stepId;
    if (!stepId) return;
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      readInlineImageFile(file, stepId);
    }
  });
}

function bindInlineImageZones(container) {
  container.querySelectorAll('.qt-img-zone').forEach(zone => {
    const stepId = zone.dataset.stepId;
    if (!stepId) return;

    // Single click → focus (for Ctrl+V paste)
    zone.addEventListener('click', e => {
      if (e.target.classList.contains('qt-img-replace-btn')) return;
      zone.focus();
      _focusedImgZoneId = stepId;
      _focusedImgZoneMode = 'preview';
    });

    zone.addEventListener('focus', () => {
      _focusedImgZoneId = stepId;
      _focusedImgZoneMode = 'preview';
      zone.classList.add('qt-img-focused');
    });
    zone.addEventListener('blur', () => {
      setTimeout(() => {
        if (_focusedImgZoneId === stepId) { _focusedImgZoneId = null; _focusedImgZoneMode = null; }
        zone.classList.remove('qt-img-focused');
      }, 500);
    });

    // Double click → enlarge (only when image exists)
    zone.addEventListener('dblclick', e => {
      if (e.target.classList.contains('qt-img-replace-btn')) return;
      if (zone.classList.contains('qt-img-has-img')) {
        const imgEl = zone.querySelector('img');
        if (imgEl) openImagePreview(imgEl.src);
      }
    });
  });
}

// Global Ctrl+V handler for focused image zone
document.addEventListener('paste', e => {
  if (!_focusedImgZoneId) return;
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) {
        // Sync mode so readInlineImageFile knows where to save
        _inlineImgTargetMode = _focusedImgZoneMode || 'preview';
        readInlineImageFile(file, _focusedImgZoneId);
      }
      break;
    }
  }
});

// ===== Image Preview Modal =====
function openImagePreview(src) {
  // Remove existing
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
  // ESC to close
  const onKey = e => { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
}

// ===== Task Type Inline Dropdown =====
let _typeDropdownCleanup = null;

function toggleTypeDropdown(event, stepId) {
  event.stopPropagation();
  // Close existing dropdown first
  closeTypeDropdown();

  const badge = event.currentTarget;
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step) return;

  // Build dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'type-dropdown-menu';

  TASK_TYPES.forEach(t => {
    const item = document.createElement('div');
    item.className = 'type-dropdown-item' + (step.taskType === t.value ? ' active' : '');
    const dot = t.color ? `<span class="type-dd-dot" style="background:${t.color}"></span>` : `<span class="type-dd-dot type-dd-dot-empty"></span>`;
    item.innerHTML = `${dot}<span>${t.label}</span>`;
    item.addEventListener('click', e => {
      e.stopPropagation();
      setStepTaskType(stepId, t.value);
      closeTypeDropdown();
    });
    dropdown.appendChild(item);
  });

  // Position relative to badge
  document.body.appendChild(dropdown);
  const rect = badge.getBoundingClientRect();
  dropdown.style.top  = (rect.bottom + 4) + 'px';
  dropdown.style.left = Math.min(rect.left, window.innerWidth - 160) + 'px';

  // Close on outside click
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
  // Clear colorOverride so the type color takes effect
  step.colorOverride = null;
  saveAllQdds();
  // Re-render preview
  if (STATE.layout === 'table') renderTableLayout();
  else renderTimelineLayout();
  renderStepsList();
}

  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== Helpers =====
function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
/** 同 esc()，但将 \n 也转换为 <br>，用于在 innerHTML / contenteditable 中保留换行 */
function escWithBr(str) {
  return esc(str).replace(/\n/g, '<br>');
}

// ===== Inject static modal shells =====
document.body.insertAdjacentHTML('beforeend', `
  <div id="step-editor" class="hidden"></div>
  <div id="import-modal" class="hidden"></div>
  <div id="toast"></div>
`);

// ===== Image Upload Helpers =====
function triggerImageFileSelect() {
  const fi = document.getElementById('ef-image-file');
  if (fi) fi.click();
}

function handleImageFileChange(input) {
  if (!input.files || !input.files[0]) return;
  fileToBase64(input.files[0], setImagePreview);
}

function fileToBase64(file, callback) {
  if (!file.type.startsWith('image/')) { showToast('❌ 请选择图片文件'); return; }
  const reader = new FileReader();
  reader.onload = e => callback(e.target.result);
  reader.readAsDataURL(file);
}

function setImagePreview(src) {
  const preview = document.getElementById('ef-image-preview');
  const urlInput = document.getElementById('ef-image');
  const clearBtn = document.getElementById('ef-image-clear');
  if (!preview) return;
  preview.innerHTML = `<img src="${src}" alt="预览">`;
  if (urlInput) urlInput.value = src;
  if (clearBtn) clearBtn.style.display = '';
}

function clearImageField() {
  const preview = document.getElementById('ef-image-preview');
  const urlInput = document.getElementById('ef-image');
  const clearBtn = document.getElementById('ef-image-clear');
  if (preview) preview.innerHTML = '<span class="image-upload-hint">📷 拖入图片 / Ctrl+V 粘贴 / 点击选择</span>';
  if (urlInput) urlInput.value = '';
  if (clearBtn) clearBtn.style.display = 'none';
  const fi = document.getElementById('ef-image-file');
  if (fi) fi.value = '';
}

function handleImageUrlInput(val) {
  const preview = document.getElementById('ef-image-preview');
  const clearBtn = document.getElementById('ef-image-clear');
  if (!preview) return;
  if (val.trim()) {
    preview.innerHTML = `<img src="${esc(val.trim())}" alt="预览" onerror="this.parentElement.innerHTML='<span class=\\'image-upload-hint\\'>图片加载失败，请检查地址</span>'">`;
    if (clearBtn) clearBtn.style.display = '';
  } else {
    preview.innerHTML = '<span class="image-upload-hint">📷 拖入图片 / Ctrl+V 粘贴 / 点击选择</span>';
    if (clearBtn) clearBtn.style.display = 'none';
  }
}

function bindImageDropZone() {
  const zone = document.getElementById('ef-image-drop-zone');
  if (!zone) return;

  // Drag & Drop
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) fileToBase64(file, setImagePreview);
  });

  // Click on preview to pick file
  const preview = zone.querySelector('#ef-image-preview');
  if (preview) {
    preview.addEventListener('click', () => {
      if (!preview.querySelector('img')) triggerImageFileSelect();
    });
  }
}

function bindImagePaste() {
  document.addEventListener('paste', e => {
    // Only when editor is open
    const editor = document.getElementById('step-editor');
    if (!editor || editor.classList.contains('hidden')) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) fileToBase64(file, setImagePreview);
        break;
      }
    }
  });
}

// Bind paste once globally
bindImagePaste();

// ===== Start =====
init();