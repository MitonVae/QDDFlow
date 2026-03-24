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

// 鈹€鈹€ Image zone drag-drop: delegated on document (survives re-renders) 鈹€鈹€
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

    // Single click 鈫?focus (for Ctrl+V paste)
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

    // Double click 鈫?enlarge (only when image exists)
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
      <img class="img-preview-img" src="${esc(src)}" alt="棰勮">
      <div class="img-preview-hint">鐐瑰嚮浠绘剰澶勫叧闂?/div>
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

// ===== TIMELINE LAYOUT =====
function renderTimelineLayout() {
  const $previewCanvas = document.getElementById('preview-canvas');
  if (!$previewCanvas) return;
  const title = document.getElementById('questTitle')?.value || STATE.questTitle;
  const steps = STATE.steps;

  // Build grid column template:
  // Each step gets a fixed-width col (controlled by colWidth slider),
  // between steps there's a narrow arrow col
  const colW = STATE.colWidth + 'px';
  const gridCols = steps.map((_, i) =>
    i < steps.length - 1 ? `${colW} 36px` : colW
  ).join(' ');

  // 鈹€鈹€ Row 1: Title boxes + arrows 鈹€鈹€
  const titleCells = steps.map((step, i) => {
    const color = getStepColor(step, i);
    const colIdx = i * 2 + 1; // 1-based grid column
    const typeInfo = step.taskType && TASK_TYPE_MAP[step.taskType] ? TASK_TYPE_MAP[step.taskType] : null;
    const badgeHtml = `<span class="qt-type-badge" data-step-id="${step.id}" onclick="toggleTypeDropdown(event,'${step.id}')" title="鐐瑰嚮鍒囨崲浠诲姟绫诲瀷">${typeInfo ? typeInfo.label.split(' ')[0] : '锛嬬被鍨?}</span>`;
    const arrowCell = i < steps.length - 1
      ? `<div class="tl-arrow-cell" style="grid-column:${colIdx + 1};grid-row:1">鈫?/div>`

function clearImageField() {
  const preview = document.getElementById('ef-image-preview');
  const urlInput = document.getElementById('ef-image');
  const clearBtn = document.getElementById('ef-image-clear');
  if (preview) preview.innerHTML = '<span class="image-upload-hint">馃摲 鎷栧叆鍥剧墖 / Ctrl+V 绮樿创 / 鐐瑰嚮閫夋嫨</span>';
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
    preview.innerHTML = `<img src="${esc(val.trim())}" alt="棰勮" onerror="this.parentElement.innerHTML='<span class=\\'image-upload-hint\\'>鍥剧墖鍔犺浇澶辫触锛岃妫€鏌ュ湴鍧€</span>'">`;
    if (clearBtn) clearBtn.style.display = '';
  } else {
    preview.innerHTML = '<span class="image-upload-hint">馃摲 鎷栧叆鍥剧墖 / Ctrl+V 绮樿创 / 鐐瑰嚮閫夋嫨</span>';
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
