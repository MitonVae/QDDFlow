// ===== Global Events (bound once) =====
function bindGlobalEvents() {
  // Theme select (always in DOM)
  const $themeSelect = document.getElementById('themeSelect');
  if ($themeSelect) $themeSelect.addEventListener('change', e => { applyTheme(e.target.value); savePrefs(); });

  // Close modals on backdrop click
  document.getElementById('step-editor').addEventListener('click', e => {
    if (e.target === document.getElementById('step-editor')) closeStepEditor();
  });
  document.getElementById('import-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('import-modal')) closeImportModal();
  });

  // Keyboard shortcuts: Undo / Redo
  document.addEventListener('keydown', e => {
    const inInput = ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName) ||
      e.target.contentEditable === 'true';
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      if (inInput) return; // let browser handle native undo in inputs
      e.preventDefault();
      undoHistory();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      if (inInput) return;
      e.preventDefault();
      redoHistory();
    }
    // Ctrl+S: manual save toast
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveAllQdds();
      showToast('✓ 已保存');
    }
  });

  // Auto-save every 30 seconds
  setInterval(() => {
    if (STATE.view === 'editor') {
      const qdd = getCurrentQdd();
      if (qdd) { syncQddFromState(qdd); saveAllQdds(); }
      // Also write autosave backup slot
      const stamp = new Date().toISOString();
      try {
        localStorage.setItem('qdd_autosave', JSON.stringify({ ts: stamp, qdds: STORE.qdds }));
      } catch(e) {}
      updateAutoSaveLabel(stamp);
    }
  }, 30000);
}

function updateAutoSaveLabel(isoTs) {
  const el = document.getElementById('autosave-label');
  if (!el) return;
  if (isoTs) {
    const d = new Date(isoTs);
    el.textContent = `自动保存 ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  } else {
    el.textContent = '';
  }
}

// ===== Editor page events (re-bound each time editor page is shown) =====
function bindEditorEvents() {
  const $addStepBtn    = document.getElementById('addStepBtn');
  const $layoutSelect  = document.getElementById('layoutSelect');
  const $questTitleInput = document.getElementById('questTitle');
  const $importFileInput = document.getElementById('importFile');
  const $exportPngBtn  = document.getElementById('exportPngBtn');
  const $exportPdfBtn  = document.getElementById('exportPdfBtn');
  const $backBtn       = document.getElementById('backToHomeBtn');
  const $slider        = document.getElementById('colWidthSlider');
  const $label         = document.getElementById('colWidthVal');

  if ($addStepBtn)    $addStepBtn.addEventListener('click', () => openStepEditor(null));
  if ($layoutSelect)  {
    $layoutSelect.value = STATE.layout;
    $layoutSelect.addEventListener('change', e => { STATE.layout = e.target.value; savePrefs(); renderPreview(); });
  }
  if ($questTitleInput) {
    $questTitleInput.value = STATE.questTitle;
    $questTitleInput.addEventListener('input', e => {
      STATE.questTitle = e.target.value;
      const qdd = getCurrentQdd();
      if (qdd) { qdd.title = e.target.value; saveAllQdds(); }
      renderPreview();
    });
  }
  if ($importFileInput) $importFileInput.addEventListener('change', handleImportFile);
  if ($exportPngBtn)    $exportPngBtn.addEventListener('click', exportPng);
  if ($exportPdfBtn)    $exportPdfBtn.addEventListener('click', exportPdf);
  if ($backBtn) $backBtn.addEventListener('click', showHomePage);
  if ($slider) {
    $slider.value = STATE.colWidth;
    if ($label) $label.textContent = STATE.colWidth;
    $slider.addEventListener('input', e => {
      STATE.colWidth = parseInt(e.target.value, 10);
      if ($label) $label.textContent = STATE.colWidth;
      savePrefs();
      renderPreview();
    });
  }
  // Sync theme select
  const $ts = document.getElementById('themeSelect');
  if ($ts) $ts.value = STATE.theme;

  // Undo / Redo buttons
  const $undoBtn = document.getElementById('undoBtn');
  const $redoBtn = document.getElementById('redoBtn');
  if ($undoBtn) $undoBtn.addEventListener('click', undoHistory);
  if ($redoBtn) $redoBtn.addEventListener('click', redoHistory);
  updateUndoRedoUI();

  // Backup JSON
  const $backupBtn = document.getElementById('backupJsonBtn');
  if ($backupBtn) $backupBtn.addEventListener('click', exportBackupJson);

  // Restore JSON
  const $restoreInput = document.getElementById('restoreJsonFile');
  if ($restoreInput) $restoreInput.addEventListener('change', handleRestoreJson);

  // AI Import Panel
  const $aiImportBtn = document.getElementById('aiImportBtn');
  if ($aiImportBtn) $aiImportBtn.addEventListener('click', openAiImportPanel);
}

const THEME_ICONS = { light: '☀️', dark: '🌙', cyber: '💜' };

function applyTheme(theme) {
  STATE.theme = theme;
  document.body.className = `theme-${theme}`;
  // Update theme icon in toolbar if present
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = THEME_ICONS[theme] || '🎨';
  // Keep select in sync
  const sel = document.getElementById('themeSelect');
  if (sel) sel.value = theme;
}

// ===== Render All =====
function renderAll() {
  renderStepsList();
  renderPreview();
}

// ===== Navigate preview to step =====
function scrollPreviewToStep(stepId) {
  // Use requestAnimationFrame to ensure DOM is ready after render
  requestAnimationFrame(() => {
    const scrollWrap = document.getElementById('preview-scroll-wrap');
    if (!scrollWrap) return;

    // Find the element with data-step-id in the preview canvas
    // Table layout: qt-col-header, Timeline layout: tl-title-cell
    const canvas = document.getElementById('preview-canvas');
    if (!canvas) return;

    let target =
      canvas.querySelector(`.qt-col-header [data-step-id="${stepId}"]`)?.closest('.qt-step-cell') ||
      canvas.querySelector(`.tl-title-cell [data-step-id="${stepId}"]`)?.closest('.tl-title-cell') ||
      canvas.querySelector(`[data-step-id="${stepId}"]`);

    if (!target) return;

    // Calculate position to center the target horizontally in the scroll wrap
    const wrapRect   = scrollWrap.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const scrollLeft = scrollWrap.scrollLeft + targetRect.left - wrapRect.left
                       - wrapRect.width / 2 + targetRect.width / 2;

    scrollWrap.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
  });
}

// ===== Batch Mode =====
let _batchMode = false;
let _batchSelected = new Set();

function toggleBatchMode() {
  _batchMode = !_batchMode;
  if (!_batchMode) _batchSelected.clear();
  renderStepsList();
}

function selectAllSteps() {
  STATE.steps.forEach(s => _batchSelected.add(s.id));
  renderStepsList();
}

function batchDeleteSteps() {
  if (_batchSelected.size === 0) { showToast('请先选择环节'); return; }
  STATE.steps = STATE.steps.filter(s => !_batchSelected.has(s.id));
  if (_batchSelected.has(STATE.activeStepId)) STATE.activeStepId = null;
  _batchSelected.clear();
  _batchMode = false;
  const qdd = getCurrentQdd(); if (qdd) { syncQddFromState(qdd); saveAllQdds(); }
  renderAll();
  showToast('已批量删除');
}

// ===== Render Steps List (Left Panel) =====
function renderStepsList() {
  const $stepCount = document.getElementById('step-count');
  const $stepsList = document.getElementById('steps-list');
  if (!$stepCount || !$stepsList) return;
  $stepCount.textContent = `${STATE.steps.length} 个环节`;

  // Batch toggle button in header
  const batchToggleBtn = document.getElementById('slBatchToggle');
  if (batchToggleBtn) {
    batchToggleBtn.textContent = _batchMode ? '退出批量' : '批量操作';
    batchToggleBtn.classList.toggle('active', _batchMode);
  }
  // Batch action bar
  const batchBar = document.getElementById('slBatchBar');
  if (batchBar) batchBar.classList.toggle('hidden', !_batchMode);

  $stepsList.innerHTML = '';

  STATE.steps.forEach((step, i) => {
    const item = document.createElement('div');
    const isActive = STATE.activeStepId === step.id;
    const isChecked = _batchSelected.has(step.id);
    item.className = 'step-item'
      + (isActive ? ' active' : '')
      + (isChecked ? ' batch-selected' : '');
    item.dataset.id = step.id;
    item.draggable = !_batchMode;
    const typeLabel = step.taskType ? ` <span class="step-type-badge">${step.taskType}</span>` : '';
    if (_batchMode) {
      item.innerHTML = `
        <input type="checkbox" class="batch-cb" ${isChecked ? 'checked' : ''}>
        <span class="step-color-dot" style="background:${getStepColor(step, i)}"></span>
        <span class="step-item-name">${esc(step.name || '未命名环节')}${typeLabel}</span>
      `;
      item.addEventListener('click', e => {
        if (isChecked) _batchSelected.delete(step.id);
        else _batchSelected.add(step.id);
        renderStepsList();
      });
    } else {
      item.innerHTML = `
        <span class="step-drag-handle" title="拖拽排序">⠿</span>
        <span class="step-color-dot" style="background:${getStepColor(step, i)}"></span>
        <span class="step-item-name">${esc(step.name || '未命名环节')}${typeLabel}</span>
        <span class="step-item-actions">
          <button title="编辑" onclick="openStepEditor('${step.id}')">✏️</button>
          <button title="上移" onclick="moveStep('${step.id}', -1)">▲</button>
          <button title="下移" onclick="moveStep('${step.id}', 1)">▼</button>
          <button class="del-btn" title="删除" onclick="deleteStep('${step.id}')">🗑</button>
        </span>
      `;
      item.addEventListener('click', e => {
        if (e.target.closest('.step-item-actions')) return;
        STATE.activeStepId = step.id;
        renderStepsList();
        scrollPreviewToStep(step.id);
      });
      item.addEventListener('dragstart', dragStart);
      item.addEventListener('dragover', dragOver);
      item.addEventListener('drop', dragDrop);
      item.addEventListener('dragend', dragEnd);
    }
    $stepsList.appendChild(item);
  });
}

// ===== Drag & Drop =====
let dragSrcId = null;
function dragStart(e) {
  dragSrcId = e.currentTarget.dataset.id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function dragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}
function dragDrop(e) {
  e.preventDefault();
  const targetId = e.currentTarget.dataset.id;
  if (dragSrcId && targetId && dragSrcId !== targetId) {
    const si = STATE.steps.findIndex(s => s.id === dragSrcId);
    const ti = STATE.steps.findIndex(s => s.id === targetId);
    const [moved] = STATE.steps.splice(si, 1);
    STATE.steps.splice(ti, 0, moved);
    renderAll();
  }
}
function dragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  dragSrcId = null;
}

// ===== Step CRUD =====
function moveStep(id, dir) {
  const i = STATE.steps.findIndex(s => s.id === id);
  const j = i + dir;
  if (j < 0 || j >= STATE.steps.length) return;
  [STATE.steps[i], STATE.steps[j]] = [STATE.steps[j], STATE.steps[i]];
  const qdd = getCurrentQdd(); if (qdd) { syncQddFromState(qdd); saveAllQdds(); }
  renderAll();
}

function deleteStep(id) {
  STATE.steps = STATE.steps.filter(s => s.id !== id);
  if (STATE.activeStepId === id) STATE.activeStepId = null;
  const qdd = getCurrentQdd(); if (qdd) { syncQddFromState(qdd); saveAllQdds(); }
  renderAll();
  showToast('环节已删除');
}

// ===== Step Editor Modal =====
// ===== Step Property Panel =====
let _propPanelStepId = null;

function openStepPanel(stepId) {
  // Toggle: clicking same header again closes the panel
  if (_propPanelStepId === stepId) {
    closeStepPanel();
    return;
  }
  _propPanelStepId = stepId;
  STATE.activeStepId = stepId;
  renderStepsList(); // highlight active in left list

  const panel = document.getElementById('step-prop-panel');
  if (!panel) return;
  panel.classList.remove('prop-panel-hidden');
  renderStepPanel();
}

function closeStepPanel() {
  _propPanelStepId = null;
  const panel = document.getElementById('step-prop-panel');
  if (panel) panel.classList.add('prop-panel-hidden');
  // Remove active highlight
  STATE.activeStepId = null;
  renderStepsList();
}

function renderStepPanel() {
  const body = document.getElementById('prop-panel-body');
  const titleEl = document.getElementById('prop-panel-title');
  if (!body) return;

  const step = STATE.steps.find(s => s.id === _propPanelStepId);
  if (!step) { closeStepPanel(); return; }

  if (titleEl) titleEl.textContent = step.name || '未命名环节';

  // Ensure step has images array (backwards compat)
  if (!step.images) step.images = step.imageUrl ? [step.imageUrl] : [];

  // Task type options
  const taskTypeOpts = TASK_TYPES.map(t =>
    `<option value="${esc(t.value)}"${t.value === (step.taskType||'') ? ' selected' : ''}>${esc(t.label)}</option>`
  ).join('');

  // Trigger options
  const triggerOpts = ['', ...TRIGGER_OPTIONS].map(v =>
    `<option value="${esc(v)}"${v === (step.trigger||'') ? ' selected' : ''}>${v || '—'}</option>`
  ).join('');

  // Custom fields rows
  const cfRows = (step.customFields || []).map((f, fi) => `
    <div class="pp-cf-row" data-fi="${fi}">
      <input class="pp-cf-key" type="text" placeholder="参数名" value="${esc(f.key)}"
        onchange="updateCustomFieldKey('${step.id}',${fi},this.value)">
      <input class="pp-cf-val" type="text" placeholder="参数值" value="${esc(f.value)}"
        onchange="updateCustomFieldVal('${step.id}',${fi},this.value)">
      <button class="pp-cf-del" onclick="deleteCustomField('${step.id}',${fi})" title="删除此字段">×</button>
    </div>`).join('');

  // Images list
  const imgItems = (step.images || []).map((url, ii) => `
    <div class="pp-img-item" data-ii="${ii}">
      <img src="${esc(url)}" alt="图${ii+1}" onclick="openImagePreview('${esc(url)}')">
      <button class="pp-img-del" onclick="deletePanelImage('${step.id}',${ii})" title="删除">×</button>
    </div>`).join('');

  body.innerHTML = `
    <div class="pp-section">
      <label class="pp-label">环节名称</label>
      <input class="pp-input" type="text" id="pp-name" value="${esc(step.name||'')}"
        oninput="savePanelField('${step.id}','name',this.value)">
    </div>

    <div class="pp-section pp-row2">
      <div>
        <label class="pp-label">任务类型</label>
        <select class="pp-select" id="pp-tasktype"
          onchange="savePanelTaskType('${step.id}',this.value)">${taskTypeOpts}</select>
      </div>
      <div>
        <label class="pp-label">触发方式</label>
        <select class="pp-select" id="pp-trigger"
          onchange="savePanelField('${step.id}','trigger',this.value)">${triggerOpts}</select>
      </div>
    </div>

    <div class="pp-section">
      <label class="pp-label">位置</label>
      <input class="pp-input" type="text" id="pp-location" placeholder="如：武康大楼·大厅"
        value="${esc(step.location||'')}" oninput="savePanelField('${step.id}','location',this.value)">
    </div>

    <div class="pp-section">
      <label class="pp-label">出场人物</label>
      <input class="pp-input" type="text" id="pp-characters" placeholder="如：柚柠, 程醒"
        value="${esc(step.characters||'')}" oninput="savePanelField('${step.id}','characters',this.value)">
    </div>

    <div class="pp-section">
      <label class="pp-label">描述</label>
      <textarea class="pp-textarea" id="pp-desc"
        oninput="savePanelField('${step.id}','desc',this.value)">${esc(step.desc||'')}</textarea>
    </div>

    <div class="pp-section">
      <label class="pp-label">配图
        <button class="pp-img-add-btn" onclick="addPanelImage('${step.id}')" title="从文件选择">＋ 添加</button>
      </label>
      <div class="pp-img-list" id="pp-img-list-${step.id}">
        ${imgItems}
        <div class="pp-img-drop-zone" data-step-id="${step.id}"
          onclick="addPanelImage('${step.id}')"
          tabindex="0"
          title="点击添加 / 拖入图片 / Ctrl+V">
          📷 拖入或点击添加
        </div>
      </div>
    </div>

    <div class="pp-section">
      <label class="pp-label">自定义字段
        <button class="pp-cf-add-btn" onclick="addCustomField('${step.id}')">＋ 添加字段</button>
      </label>
      <div class="pp-cf-list" id="pp-cf-list">${cfRows}</div>
    </div>

    <div class="pp-section pp-danger-zone">
      <button class="pp-del-step-btn" onclick="deletePanelStep('${step.id}')">🗑 删除此环节</button>
      <button class="pp-add-step-btn" onclick="addStep()">＋ 在此后新增环节</button>
    </div>
  `;

  // Bind drag-drop on the image drop zone
  bindPanelImageDropZone(step.id);
}

// ── Panel field savers ──
function savePanelField(stepId, field, val) {
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step) return;
  step[field] = val;
  saveAllQdds();
  // Live-refresh preview without closing panel
  if (field === 'name') {
    const titleEl = document.getElementById('prop-panel-title');
    if (titleEl) titleEl.textContent = val || '未命名环节';
    renderStepsList();
  }
  // Partial re-render: just re-render the preview (fast)
  renderPreview();
}

function savePanelTaskType(stepId, typeValue) {
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step) return;
  step.taskType = typeValue;
  step.colorOverride = null;
  saveAllQdds();
  renderStepsList();
  renderPreview();
}

function updateCustomFieldKey(stepId, fi, val) {
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step || !step.customFields[fi]) return;
  step.customFields[fi].key = val;
  saveAllQdds();
  renderPreview();
}
function updateCustomFieldVal(stepId, fi, val) {
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step || !step.customFields[fi]) return;
  step.customFields[fi].value = val;
  saveAllQdds();
  renderPreview();
}
function addCustomField(stepId) {
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step) return;
  if (!step.customFields) step.customFields = [];
  step.customFields.push({ key: '', value: '' });
  saveAllQdds();
  renderStepPanel();
  renderPreview();
}
function deleteCustomField(stepId, fi) {
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step) return;
  step.customFields.splice(fi, 1);
  saveAllQdds();
  renderStepPanel();
  renderPreview();
}

function deletePanelStep(stepId) {
  if (!confirm('确认删除此环节？')) return;
  STATE.steps = STATE.steps.filter(s => s.id !== stepId);
  const qdd = getCurrentQdd(); if (qdd) { syncQddFromState(qdd); saveAllQdds(); }
  closeStepPanel();
  renderAll();
  showToast('环节已删除');
}

function getPrevStepDefaults() {
  // Get the step that is currently active/open in the panel, or the last step
  const refId = _propPanelStepId || (STATE.steps.length > 0 ? STATE.steps[STATE.steps.length - 1].id : null);
  const ref = refId ? STATE.steps.find(s => s.id === refId) : null;
  if (!ref) return {};
  return {
    trigger:    ref.trigger    || '',
    location:   ref.location   || '',
    characters: ref.characters || '',
    taskType:   ref.taskType   || '',
  };
}

function addStep() {
  const defaults = getPrevStepDefaults();
  const newStep = {
    id: genId(), name: '新环节',
    trigger:    defaults.trigger,
    location:   defaults.location,
    characters: defaults.characters,
    taskType:   defaults.taskType,
    desc: '', imageUrl: '', images: [], color: '', customFields: [],
  };
  // Insert after active step, or at end
  const idx = _propPanelStepId
    ? STATE.steps.findIndex(s => s.id === _propPanelStepId)
    : -1;
  if (idx >= 0) STATE.steps.splice(idx + 1, 0, newStep);
  else STATE.steps.push(newStep);
  const qdd = getCurrentQdd(); if (qdd) { syncQddFromState(qdd); saveAllQdds(); }
  renderAll();
  openStepPanel(newStep.id);
}

function addMultipleSteps() {
  const countInput = document.getElementById('addCountInput');
  const count = Math.max(1, Math.min(20, parseInt(countInput?.value || '1', 10)));
  const defaults = getPrevStepDefaults();
  for (let i = 0; i < count; i++) {
    STATE.steps.push({
      id: genId(), name: `新环节`,
      trigger:    defaults.trigger,
      location:   defaults.location,
      characters: defaults.characters,
      taskType:   defaults.taskType,
      desc: '', imageUrl: '', images: [], color: '', customFields: [],
    });
  }
  const qdd = getCurrentQdd(); if (qdd) { syncQddFromState(qdd); saveAllQdds(); }
  renderAll();
  showToast(`已添加 ${count} 个环节`);
}

// ── Panel image management ──
function addPanelImage(stepId) {
  _openImageFilePicker(stepId, 'panel');
}

function deletePanelImage(stepId, ii) {
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step || !step.images) return;
  step.images.splice(ii, 1);
  // Keep legacy imageUrl in sync
  step.imageUrl = step.images[0] || '';
  saveAllQdds();
  renderStepPanel();
  renderPreview();
}

function bindPanelImageDropZone(stepId) {
  const zone = document.querySelector(`#pp-img-list-${stepId} .pp-img-drop-zone`);
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('qt-img-drop-hover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('qt-img-drop-hover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('qt-img-drop-hover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      _inlineImgTargetId = stepId;
      _inlineImgTargetMode = 'panel';
      readInlineImageFile(file, stepId);
    }
  });
  // Ctrl+V paste on panel zone (focused)
  zone.addEventListener('focus', () => { _focusedImgZoneId = stepId; _focusedImgZoneMode = 'panel'; _inlineImgTargetMode = 'panel'; });
  zone.addEventListener('blur',  () => { setTimeout(() => { if (_focusedImgZoneId === stepId) { _focusedImgZoneId = null; _focusedImgZoneMode = null; } }, 500); });
  // Click also sets focus state (since onclick=addPanelImage steals focus before paste can fire)
  zone.addEventListener('mousedown', () => { _focusedImgZoneId = stepId; _focusedImgZoneMode = 'panel'; _inlineImgTargetMode = 'panel'; });
}
