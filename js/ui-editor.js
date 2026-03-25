function buildEditorPageHTML() {
  return `
    <header id="toolbar">
      <div class="toolbar-left">
        <span class="app-title">QDD Flow</span>
        <button class="tb-btn tb-back-btn" id="backToHomeBtn">← 返回</button>
        <span class="quest-name-wrap">
          <input type="text" id="questTitle" placeholder="任务名称..." value="${esc(STATE.questTitle)}">
        </span>
      </div>
      <div class="toolbar-center">
        <label class="tb-btn" title="布局切换">
          <span>布局</span>
          <select id="layoutSelect">
            <option value="table">📋 表格式</option>
            <option value="timeline">🎯 时间轴式</option>
          </select>
        </label>
        <label class="tb-btn" title="主题">
          <span>主题</span>
          <select id="themeSelect">
            <option value="light">☀️ 亮色</option>
            <option value="dark">🌙 深色</option>
            <option value="cyber">💜 赛博</option>
          </select>
        </label>
        <label class="tb-btn tb-slider-btn" title="调整列宽">
          <span>列宽 <span id="colWidthVal">${STATE.colWidth}</span>px</span>
          <input type="range" id="colWidthSlider" min="120" max="380" step="10" value="${STATE.colWidth}">
        </label>
      </div>
      <div class="toolbar-right">
        <button class="tb-btn tb-undo-btn" id="undoBtn" disabled title="撤回 (Ctrl+Z)">↩ 撤回</button>
        <button class="tb-btn tb-undo-btn" id="redoBtn" disabled title="重做 (Ctrl+Y)">↪ 重做</button>
        <span class="tb-divider"></span>
        <label class="tb-btn icon-btn" title="导入Excel/CSV">
          📂 导入
          <input type="file" id="importFile" accept=".xlsx,.xls,.csv" style="display:none">
        </label>
        <label class="tb-btn icon-btn" title="从JSON备份文件恢复">
          📥 恢复
          <input type="file" id="restoreJsonFile" accept=".json" style="display:none">
        </label>
        <button class="tb-btn" id="backupJsonBtn" title="导出全部数据为JSON备份文件">💾 备份</button>
        <button class="tb-btn tb-btn-ai" id="aiImportBtn" title="用AI生成QDD结构并导入">🤖 AI 导入</button>
        <button class="tb-btn" id="addStepBtn">➕ 添加环节</button>
        <span id="autosave-label" class="tb-autosave-label"></span>
        <button class="tb-btn" id="shareLinkBtn" title="生成分享链接">🔗 分享</button>
        <button class="tb-btn" id="exportPngBtn">🖼️ 导出PNG</button>
        <button class="tb-btn" id="exportPdfBtn">📄 导出PDF</button>
      </div>
    </header>
    <div id="main">
      <aside id="editor-panel">
        <div id="editor-panel-header">
          <span>环节列表</span>
          <small id="step-count">0 个环节</small>
          <button class="sl-batch-toggle" id="slBatchToggle" onclick="toggleBatchMode()">批量操作</button>
        </div>
        <div id="steps-list"></div>
        <div id="steps-list-footer">
          <div class="batch-action-bar hidden" id="slBatchBar">
            <button class="sl-select-all-btn" onclick="selectAllSteps()">全选</button>
            <button class="sl-batch-del-btn" onclick="batchDeleteSteps()">🗑 删除所选</button>
            <button class="sl-batch-cancel-btn" onclick="toggleBatchMode()">取消</button>
          </div>
          <div class="sl-add-row">
            <button class="sl-add-btn" onclick="addStep()">＋ 添加环节</button>
            <input type="number" id="addCountInput" min="1" max="20" value="1" title="一次添加多个" style="width:48px">
            <button class="sl-add-btn" onclick="addMultipleSteps()" title="批量添加">批量</button>
          </div>
        </div>
      </aside>
      <main id="preview-area">
        <div id="preview-scroll-wrap">
          <div id="preview-canvas"></div>
        </div>
      </main>
      <!-- Step Property Panel: fixed right column -->
      <div id="step-prop-panel" class="prop-panel prop-panel-hidden">
        <div class="prop-panel-header">
          <span class="prop-panel-title" id="prop-panel-title">环节属性</span>
          <button class="prop-panel-close" onclick="closeStepPanel()" title="关闭">×</button>
        </div>
        <div class="prop-panel-body" id="prop-panel-body">
          <!-- filled by renderStepPanel() -->
        </div>
      </div>
    </div>
  `;
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
function openStepEditor(id) {
  STATE.editingStepId = id;
  const step = id ? STATE.steps.find(s => s.id === id) : null;
  const modal = document.getElementById('step-editor');
  modal.classList.remove('hidden');

  const title = step ? `编辑环节：${step.name}` : '新增环节';
  const currentTaskType = step?.taskType || '';
  // Color: use colorOverride if set, else derive from taskType, else preset
  const defaultColor = currentTaskType && TASK_TYPE_MAP[currentTaskType]
    ? TASK_TYPE_MAP[currentTaskType].color
    : (PRESET_COLORS[STATE.steps.length % PRESET_COLORS.length]);
  const selectedColor = step?.colorOverride || step?.color || defaultColor;

  const taskTypeOptionsHtml = TASK_TYPES.map(t =>
    `<option value="${t.value}"${t.value === currentTaskType ? ' selected' : ''}>${t.label}</option>`
  ).join('');

  const triggerOptionsHtml = ['', ...TRIGGER_OPTIONS].map(v =>
    `<option value="${v}"${v === (step?.trigger||'') ? ' selected' : ''}>${v || '—'}</option>`
  ).join('');

  const colorDotsHtml = PRESET_COLORS.map(c =>
    `<span class="color-preset-dot${c === selectedColor ? ' selected' : ''}" style="background:${c}" data-color="${c}" onclick="selectPresetColor('${c}')"></span>`
  ).join('');

  const customFieldsHtml = (step?.customFields || []).map((f, fi) =>
    renderCustomFieldRow(fi, f.key, f.value)
  ).join('');

  modal.innerHTML = `
    <div class="editor-modal">
      <div class="editor-modal-header">
        <h3>${title}</h3>
        <button class="editor-modal-close" onclick="closeStepEditor()">×</button>
      </div>
      <div class="editor-modal-body">
        <div class="form-row">
          <label>环节名称 *</label>
          <input type="text" id="ef-name" placeholder="如：0.任务接取" value="${esc(step?.name||'')}">
        </div>
        <div class="form-grid-2">
          <div class="form-row">
            <label>任务类型</label>
            <select id="ef-tasktype" onchange="onTaskTypeChange(this.value)">
              ${taskTypeOptionsHtml}
            </select>
          </div>
          <div class="form-row">
            <label>触发方式</label>
            <select id="ef-trigger">
              ${triggerOptionsHtml}
            </select>
          </div>
          <div class="form-row">
            <label>位置</label>
            <input type="text" id="ef-location" placeholder="如：武康大楼·大厅" value="${esc(step?.location||'')}">
          </div>
        </div>
        <div class="form-row">
          <label>出场人物</label>
          <input type="text" id="ef-characters" placeholder="如：柚柠, 程醒" value="${esc(step?.characters||'')}">
        </div>
        <div class="form-row">
          <label>环节描述</label>
          <textarea id="ef-desc" placeholder="描述环节发生的事情...">${esc(step?.desc||'')}</textarea>
        </div>
        <div class="form-row">
          <label>配图</label>
          <div class="image-upload-area">
            <div class="image-upload-preview" id="ef-image-preview">
              ${step?.imageUrl ? `<img src="${esc(step.imageUrl)}" alt="预览">` : '<span class="image-upload-hint">📷 尚未添加配图</span>'}
            </div>
            <div class="image-upload-actions">
              <button type="button" class="img-action-btn" onclick="editorPickImage()">📂 选择图片</button>
              <button type="button" class="img-action-btn img-clear-btn" onclick="editorClearImage()" id="ef-image-clear" ${step?.imageUrl ? '' : 'style="display:none"'}>✕ 清除</button>
            </div>
            <input type="hidden" id="ef-image" value="${esc(step?.imageUrl||'')}">
          </div>
        </div>
        <div class="form-row">
          <label>环节颜色</label>
          <div class="color-row">
            <div class="color-presets" id="color-presets">${colorDotsHtml}</div>
            <input type="color" id="ef-color-picker" value="${selectedColor}" style="width:32px;height:32px;border:none;background:none;cursor:pointer;padding:0;border-radius:4px;" title="自定义颜色" onchange="syncPickerColor(this.value)">
          </div>
        </div>
        <div class="custom-fields-section">
          <h4>🔧 自定义字段</h4>
          <div id="custom-fields-list">${customFieldsHtml}</div>
          <button class="add-custom-field-btn" onclick="addCustomFieldRow()">＋ 添加自定义字段</button>
        </div>
      </div>
      <div class="editor-modal-footer">
        <button class="btn-cancel" onclick="closeStepEditor()">取消</button>
        <button class="btn-primary" onclick="saveStep()">保存</button>
      </div>
    </div>
  `;
  // Set initial color picker hidden input
  modal.querySelector('#ef-color-picker').dataset.selected = selectedColor;
}

function renderCustomFieldRow(index, key='', value='') {
  return `
    <div class="custom-field-row" data-fi="${index}">
      <input type="text" placeholder="字段名" value="${esc(key)}" class="cf-key">
      <input type="text" placeholder="值" value="${esc(value)}" class="cf-val">
      <button class="custom-field-del" onclick="removeCustomFieldRow(this)">✕</button>
    </div>
  `;
}

function addCustomFieldRow() {
  const list = document.getElementById('custom-fields-list');
  const div = document.createElement('div');
  div.innerHTML = renderCustomFieldRow(Date.now());
  list.appendChild(div.firstElementChild);
}

function removeCustomFieldRow(btn) {
  btn.closest('.custom-field-row').remove();
}

function selectPresetColor(color) {
  document.querySelectorAll('.color-preset-dot').forEach(d => d.classList.remove('selected'));
  const dot = document.querySelector(`.color-preset-dot[data-color="${color}"]`);
  if (dot) dot.classList.add('selected');
  const picker = document.getElementById('ef-color-picker');
  if (picker) { picker.value = color; picker.dataset.selected = color; }
}

function syncPickerColor(color) {
  document.querySelectorAll('.color-preset-dot').forEach(d => d.classList.remove('selected'));
  const picker = document.getElementById('ef-color-picker');
  if (picker) picker.dataset.selected = color;
}

function getSelectedColor() {
  const picker = document.getElementById('ef-color-picker');
  return picker?.dataset.selected || picker?.value || PRESET_COLORS[0];
}

function onTaskTypeChange(typeVal) {
  // Auto-fill color from taskType, but allow manual override afterwards
  if (typeVal && TASK_TYPE_MAP[typeVal]) {
    const autoColor = TASK_TYPE_MAP[typeVal].color;
    selectPresetColor(autoColor);
    // Also update the color picker
    const picker = document.getElementById('ef-color-picker');
    if (picker) { picker.value = autoColor; picker.dataset.selected = autoColor; }
  }
}

function closeStepEditor() {
  document.getElementById('step-editor').classList.add('hidden');
  STATE.editingStepId = null;
}

function saveStep() {
  const name = document.getElementById('ef-name').value.trim();
  if (!name) { alert('请填写环节名称！'); return; }

  const customFields = [];
  document.querySelectorAll('#custom-fields-list .custom-field-row').forEach(row => {
    const key = row.querySelector('.cf-key').value.trim();
    const val = row.querySelector('.cf-val').value.trim();
    if (key) customFields.push({ key, value: val });
  });

  const taskType = document.getElementById('ef-tasktype')?.value || '';
  const autoColor = taskType && TASK_TYPE_MAP[taskType] ? TASK_TYPE_MAP[taskType].color : null;
  const pickedColor = getSelectedColor();
  // colorOverride = manual if it differs from the auto color for this taskType
  const colorOverride = (autoColor && pickedColor !== autoColor) ? pickedColor : null;

  const data = {
    name,
    taskType,
    trigger: document.getElementById('ef-trigger')?.value || '',
    location: document.getElementById('ef-location').value.trim(),
    characters: document.getElementById('ef-characters').value.trim(),
    desc: document.getElementById('ef-desc').value.trim(),
    imageUrl: document.getElementById('ef-image').value.trim(),
    color: pickedColor,
    colorOverride,
    customFields,
  };

  const wasEditing = STATE.editingStepId;
  if (wasEditing) {
    const i = STATE.steps.findIndex(s => s.id === wasEditing);
    if (i >= 0) STATE.steps[i] = { ...STATE.steps[i], ...data };
  } else {
    STATE.steps.push({ id: genId(), ...data });
  }

  // Auto-save to localStorage
  const qdd = getCurrentQdd();
  if (qdd) { syncQddFromState(qdd); saveAllQdds(); }

  closeStepEditor();
  renderAll();
  showToast(wasEditing ? '环节已更新' : '环节已添加');
}
