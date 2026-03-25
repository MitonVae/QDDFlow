// ===== Preview Render =====
function renderPreview() {
  const $previewCanvas = document.getElementById('preview-canvas');
  if (!$previewCanvas) return;
  if (STATE.steps.length === 0) {
    $previewCanvas.innerHTML = `
      <div class="preview-empty">
        <div class="empty-icon">🗺️</div>
        <p>还没有环节，点击右上角「➕ 添加环节」开始设计你的 QDD 流程图</p>
      </div>`;
    return;
  }
  if (STATE.layout === 'table') renderTableLayout();
  else renderTimelineLayout();
}

// ===== TABLE LAYOUT =====
// Structure (matches reference image exactly):
//   Outer table  : one <td> per step, side by side
//   Inside each <td> : a nested 2-col table  [label | value] for each field
//   Image        : spans full cell width at top
//   Description  : spans full cell width at bottom
//   No cross-column row alignment needed — each column is self-contained.
function renderTableLayout() {
  const $previewCanvas = document.getElementById('preview-canvas');
  if (!$previewCanvas) return;
  const title = document.getElementById('questTitle')?.value || STATE.questTitle;

  const customKeys = [];
  STATE.steps.forEach(s => {
    (s.customFields || []).forEach(f => {
      if (f.key && !customKeys.includes(f.key)) customKeys.push(f.key);
    });
  });

  const fieldDefs = [
    { label: '触发方式', field: 'trigger', type: 'trigger-select' },
    { label: '位置',     field: 'location' },
    { label: '出场人物', field: 'characters' },
    ...customKeys.map(k => ({ label: k, field: k, custom: true })),
  ];

  // Build each step column cell
  const stepCells = STATE.steps.map((step, i) => {
    const color = getStepColor(step, i);
    const customMap = {};
    (step.customFields || []).forEach(f => { customMap[f.key] = f.value; });

    // ── Image：图片放在标题上方；无图时显示虚线占位区（导出时隐藏）──
    const imgUrl = getResolvedImageUrl(step.imageUrl || (step.images && step.images[0]) || '');
    const sid = step.id;
    const img = imgUrl
      ? `<div class="qt-col-img qt-img-zone" data-step-id="${sid}"
             ondragover="event.preventDefault();this.classList.add('qt-img-drop-hover')"
             ondragleave="if(!this.contains(event.relatedTarget))this.classList.remove('qt-img-drop-hover')"
             ondrop="event.preventDefault();this.classList.remove('qt-img-drop-hover');var f=event.dataTransfer.files[0];if(f)saveImageToStep(f,'${sid}')"
             title="拖入图片可替换；双击放大">
           <img src="${esc(imgUrl)}" loading="lazy"
                ondblclick="openImagePreview('${esc(imgUrl)}')"
                onerror="this.style.display='none'">
           <button class="qt-img-del-btn" onclick="event.stopPropagation();deleteStepImage('${sid}')" title="删除图片">×</button>
         </div>`
      : `<div class="qt-col-img-empty" data-step-id="${sid}" data-export-hide="1"
             onclick="pickStepImage('${sid}')"
             ondragover="event.preventDefault();this.classList.add('qt-img-drop-hover')"
             ondragleave="if(!this.contains(event.relatedTarget))this.classList.remove('qt-img-drop-hover')"
             ondrop="event.preventDefault();this.classList.remove('qt-img-drop-hover');var f=event.dataTransfer.files[0];if(f)saveImageToStep(f,'${sid}')"
             title="点击或拖入添加图片">
           <span>📷 点击或拖入图片</span>
         </div>`;

    // ── Colored title header ──
    const typeInfo = step.taskType && TASK_TYPE_MAP[step.taskType] ? TASK_TYPE_MAP[step.taskType] : null;
    const badgeHtml = `<span class="qt-type-badge" data-step-id="${step.id}" onclick="toggleTypeDropdown(event,'${step.id}')" title="点击切换任务类型">${typeInfo ? typeInfo.label.split(' ')[0] : '＋类型'}</span>`;
    const indexTag = step.index ? `<span class="qt-col-index" title="环节编号 #${esc(step.index)}">#${esc(step.index)}</span>` : '';
    const header = `<div class="qt-col-header" style="background:${color}" onclick="openStepPanel('${step.id}')" title="点击打开属性面板">
      <div class="qt-col-header-inner">
        ${indexTag}<span class="qt-editable" contenteditable="true" data-step-id="${step.id}" data-field="name" onclick="event.stopPropagation()">${esc(step.name)}</span>
        ${badgeHtml}
      </div>
    </div>`;

    // ── Fields: flex rows [label | value]，跳过空值 ──
    const fieldRows = fieldDefs.map(fd => {
      const val = fd.custom ? (customMap[fd.field] || '') : (step[fd.field] || '');
      if (fd.type === 'trigger-select') {
        const displayVal = val || '—';
        return `<div class="qt-field-row">
          <div class="qt-fl">触发方式：</div>
          <div class="qt-fv qt-fv-select" data-step-id="${step.id}" data-field="trigger"
               onclick="toggleTriggerDropdown(event,'${step.id}')" title="点击选择触发方式">${esc(displayVal)}<span class="qt-select-arrow">▾</span></div>
        </div>`;
      }
      if (!val) return '';
      return `<div class="qt-field-row">
        <div class="qt-fl">${esc(fd.label)}：</div>
        <div class="qt-fv" contenteditable="true"
          data-step-id="${step.id}" data-field="${fd.field}"
          data-custom="${fd.custom ? '1' : '0'}">${esc(val)}</div>
      </div>`;
    }).join('');
    const fields = fieldRows
      ? `<div class="qt-fields-block">${fieldRows}</div>`
      : '';

    // ── Description ──
    const desc = `<div class="qt-col-desc" contenteditable="true"
      data-step-id="${step.id}" data-field="desc">${escWithBr(step.desc || '')}</div>`;

    return `<td class="qt-step-cell" valign="top">
      <div class="qt-step-inner">${img}${header}${fields}${desc}</div>
    </td>`;
  }).join('');

  $previewCanvas.innerHTML = `
    <div class="table-wrap">
      <div class="table-title-bar">
        ${esc(title)}
        <button class="table-copy-btn" onclick="copyTableToClipboard()" title="复制整张表，可直接粘贴到 Excel / 飞书表格">📋 复制到表格</button>
      </div>
      <div class="qt-scroll">
        <table class="qt-table" cellspacing="0" cellpadding="0">
          <tbody><tr>${stepCells}</tr></tbody>
        </table>
      </div>
    </div>`;

  // Bind contenteditable
  $previewCanvas.querySelectorAll('[contenteditable]').forEach(el => {
    el.addEventListener('blur', onTableCellBlur);
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !el.classList.contains('qt-col-desc')) {
        e.preventDefault(); el.blur();
      }
    });
  });

  // 绑定图片区交互（拖入 / 点击选择 / 删除）
  bindPreviewImageZones($previewCanvas);
}

// ===== Copy Table to Clipboard =====
// Flat multi-row HTML table (no nesting). Each step = 2 cols (label|value).
// Field rows: only show a row if at least ONE step has a value for that field.
// For steps without a value in that row → show empty cells (no label, no dash).
function copyTableToClipboard() {
  const steps = STATE.steps;
  if (!steps.length) { showToast('⚠️ 没有环节可复制'); return; }

  // Helper: escape HTML
  const h = str => String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  // Helper: hex → rgba
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  const B = `border:1px solid #bbb;`;
  const fnt = `font-family:微软雅黑,Arial,sans-serif;font-size:11px;`;
  // cell style builders
  const cs  = extra => `${B}${fnt}${extra}`;
  const lbl = color  => cs(`padding:3px 5px;background:#f0f0f0;color:#555;font-weight:600;white-space:nowrap;vertical-align:top;`);
  const val = color  => cs(`padding:3px 6px;background:${hexToRgba(color,0.05)};vertical-align:top;word-break:break-word;`);
  const emp = ()     => cs(`padding:0;background:#fff;`); // empty placeholder cell

  // Collect all field defs in order: fixed fields first, then all custom keys seen across steps
  const customKeys = [];
  steps.forEach(s => (s.customFields||[]).forEach(f => { if(f.key && !customKeys.includes(f.key)) customKeys.push(f.key); }));

  const allFields = [
    { key: '__trigger',    label: '触发方式', get: s => s.trigger || '' },
    { key: '__location',   label: '位置',     get: s => s.location || '' },
    { key: '__characters', label: '出场人物', get: s => s.characters || '' },
    ...customKeys.map(k => ({
      key: k, label: k,
      get: s => { const cf = (s.customFields||[]).find(f=>f.key===k); return cf ? (cf.value||'') : ''; }
    })),
  ];

  // Only keep field rows where at least one step has a non-empty value
  const activeFields = allFields.filter(fd => steps.some(s => fd.get(s).trim() !== ''));

  // ── Row 1: image row — each step spans 2 cols ──
  const imgCells = steps.map((step, i) => {
    const color = getStepColor(step, i);
    const imgs = step.images && step.images.length > 0 ? step.images : (step.imageUrl ? [step.imageUrl] : []);
    const resolvedImgs = imgs.map(u => getResolvedImageUrl(u)).filter(Boolean);
    const inner = resolvedImgs.length > 0
      ? resolvedImgs.map(url => `<img src="${h(url)}" style="max-width:160px;max-height:110px;display:inline-block;margin:2px;">`).join('')
      : `<span style="${fnt}color:#aaa;">🖼 在属性面板添加配图</span>`;
    return `<td colspan="2" style="${B}${fnt}padding:5px;text-align:center;vertical-align:middle;background:${hexToRgba(color,0.07)};height:80px;">${inner}</td>`;
  }).join('');

  // ── Row 2: title row — each step spans 2 cols ──
  const titleCells = steps.map((step, i) => {
    const color = getStepColor(step, i);
    const typeInfo = step.taskType && TASK_TYPE_MAP[step.taskType] ? TASK_TYPE_MAP[step.taskType] : null;
    const badge = typeInfo
      ? `<br><span style="display:inline-block;margin-top:3px;padding:1px 9px;border-radius:9px;font-size:10px;font-weight:700;background:rgba(0,0,0,0.32);color:#fff;">${h(typeInfo.value)}</span>`
      : '';
    return `<td colspan="2" style="${B}${fnt}padding:7px 6px;background:${color};color:#fff;font-weight:700;font-size:13px;text-align:center;text-shadow:0 1px 2px rgba(0,0,0,0.3);line-height:1.4;">${h(step.name||'未命名环节')}${badge}</td>`;
  }).join('');

  // ── Field rows with rowspan merging ──
  // For each step (column), merge consecutive empty field rows into one spanning cell.
  // Build a 2D grid: grid[rowIdx][stepIdx] = { html, skip }
  //   html  = the <td> pair string to emit
  //   skip  = true means this cell was absorbed into a rowspan above, don't emit

  const nRows = activeFields.length;
  const nSteps = steps.length;

  // grid[row][col] = { html: string, skip: bool }
  const grid = Array.from({length: nRows}, () => Array.from({length: nSteps}, () => ({html:'', skip:false})));

  steps.forEach((step, si) => {
    const color = getStepColor(step, si);
    const bg = hexToRgba(color, 0.05);

    // Mark which rows are empty for this step
    const isEmpty = activeFields.map(fd => fd.get(step).trim() === '');

    let ri = 0;
    while (ri < nRows) {
      if (!isEmpty[ri]) {
        // Has value — normal label+value pair
        const fd = activeFields[ri];
        const v  = fd.get(step).trim();
        grid[ri][si].html = `<td style="${lbl(color)}">${h(fd.label)}：</td><td style="${val(color)}">${h(v)}</td>`;
        ri++;
      } else {
        // Find the run of consecutive empty rows for this step
        let runEnd = ri;
        while (runEnd < nRows && isEmpty[runEnd]) runEnd++;
        const span = runEnd - ri;

        // Emit one merged empty cell spanning `span` rows (colspan=2, rowspan=span)
        const spanAttr = span > 1 ? ` rowspan="${span}"` : '';
        grid[ri][si].html = `<td colspan="2"${spanAttr} style="${B}${fnt}padding:0;background:${bg};"></td>`;
        // Mark subsequent rows in this run as skip
        for (let k = ri + 1; k < runEnd; k++) {
          grid[k][si].skip = true;
        }
        ri = runEnd;
      }
    }
  });

  // Assemble rows
  const fieldRowsHtml = Array.from({length: nRows}, (_, ri) => {
    const cells = steps.map((_, si) => {
      if (grid[ri][si].skip) return '';
      return grid[ri][si].html;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  // ── Description row — each step spans 2 cols ──
  const hasDesc = steps.some(s => (s.desc||'').trim());
  const descRowHtml = hasDesc ? `<tr>${steps.map((step,i) => {
    const color = getStepColor(step, i);
    const desc = (step.desc||'').trim().replace(/\n/g,'<br>');
    return `<td colspan="2" style="${B}${fnt}padding:6px 7px;vertical-align:top;background:${hexToRgba(color,0.05)};word-break:break-word;line-height:1.6;">${desc}</td>`;
  }).join('')}</tr>` : '';

  const tableHtml = `<table style="border-collapse:collapse;" cellspacing="0" cellpadding="0"><tbody>
    <tr>${imgCells}</tr>
    <tr>${titleCells}</tr>
    ${fieldRowsHtml}
    ${descRowHtml}
  </tbody></table>`;

  // Write both HTML and plain-text to clipboard
  const plainText = steps.map(s => {
    const lines = [s.name || '未命名环节'];
    if (s.trigger)    lines.push(`触发方式：${s.trigger}`);
    if (s.location)   lines.push(`位置：${s.location}`);
    if (s.characters) lines.push(`出场人物：${s.characters}`);
    (s.customFields||[]).forEach(f => { if(f.key) lines.push(`${f.key}：${f.value||''}`); });
    if (s.desc) lines.push(s.desc);
    return lines.join('\n');
  }).join('\n\n');

  try {
    const clipItem = new ClipboardItem({
      'text/html':  new Blob([tableHtml], { type: 'text/html' }),
      'text/plain': new Blob([plainText],  { type: 'text/plain' }),
    });
    navigator.clipboard.write([clipItem]).then(() => {
      showToast('✅ 已复制！可直接粘贴到飞书/Excel 表格（保留格式）');
    }).catch(err => {
      console.warn('ClipboardItem write failed, fallback:', err);
      _copyHtmlFallback(tableHtml, plainText);
    });
  } catch(e) {
    _copyHtmlFallback(tableHtml, plainText);
  }
}

function _copyHtmlFallback(html, plain) {
  // Use a hidden contenteditable div to write rich HTML to clipboard
  const div = document.createElement('div');
  div.contentEditable = 'true';
  div.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
  div.innerHTML = html;
  document.body.appendChild(div);
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(div);
  sel.removeAllRanges();
  sel.addRange(range);
  try {
    document.execCommand('copy');
    showToast('✅ 已复制！可直接粘贴到飞书/Excel 表格（保留格式）');
  } catch(e) {
    // Last resort: plain text
    const ta = document.createElement('textarea');
    ta.value = plain;
    ta.style.cssText = 'position:fixed;top:-9999px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('✅ 已复制（纯文本格式）');
  }
  document.body.removeChild(div);
}

function onTableCellBlur(e) {
  const el = e.currentTarget;
  const stepId = el.dataset.stepId;
  const field = el.dataset.field;
  const isCustom = el.dataset.custom === '1';
  const val = el.innerText.trim();

  const step = STATE.steps.find(s => s.id === stepId);
  if (!step) return;

  if (isCustom) {
    const cf = (step.customFields || []).find(f => f.key === field);
    if (cf) cf.value = val;
  } else {
    step[field] = val;
  }
  // Update quest title display if name changed
  if (field === 'name') renderStepsList();

  // ── Persist: sync back to STORE and save to localStorage ──
  const qdd = getCurrentQdd();
  if (qdd) { syncQddFromState(qdd); saveAllQdds(); }
}

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

  // 图片区：有图则全宽展示+删除，无图则显示选择按钮
  const _rawImgKey = step.imageUrl || (Array.isArray(step.images) && step.images[0]) || '';
  const imgUrl = getResolvedImageUrl(_rawImgKey);
  const imgSection = imgUrl
    ? `<div class="pp-img-single">
         <img src="${esc(imgUrl)}" alt="配图" onclick="openImagePreview('${esc(imgUrl)}')" title="点击放大">
         <button class="pp-img-del" onclick="deleteStepImage('${step.id}')">× 删除</button>
       </div>`
    : `<button class="pp-img-add-btn" onclick="pickStepImage('${step.id}')">📷 选择图片</button>`;

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
      <label class="pp-label">配图</label>
      ${imgSection}
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

// ===== Trigger Inline Dropdown =====
let _triggerDropdownCleanup = null;

function toggleTriggerDropdown(event, stepId) {
  event.stopPropagation();
  // Close type dropdown too
  closeTypeDropdown();
  // Close existing trigger dropdown
  if (_triggerDropdownCleanup) { _triggerDropdownCleanup(); return; }

  const cell = event.currentTarget;
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step) return;

  const dropdown = document.createElement('div');
  dropdown.className = 'type-dropdown-menu';

  // "Clear" option first
  const allOptions = ['', ...TRIGGER_OPTIONS];
  allOptions.forEach(opt => {
    const item = document.createElement('div');
    item.className = 'type-dropdown-item' + ((step.trigger || '') === opt ? ' active' : '');
    item.textContent = opt || '—（清除）';
    item.addEventListener('click', e => {
      e.stopPropagation();
      step.trigger = opt;
      saveAllQdds();
      if (_triggerDropdownCleanup) _triggerDropdownCleanup();
      // Update cell text in-place without full re-render
      cell.childNodes[0].textContent = opt || '—';
    });
    dropdown.appendChild(item);
  });

  document.body.appendChild(dropdown);
  const rect = cell.getBoundingClientRect();
  dropdown.style.top  = (rect.bottom + 2) + 'px';
  dropdown.style.left = Math.min(rect.left, window.innerWidth - 180) + 'px';

  const onOutside = () => { if (_triggerDropdownCleanup) _triggerDropdownCleanup(); };
  setTimeout(() => document.addEventListener('click', onOutside, { once: true }), 0);
  _triggerDropdownCleanup = () => {
    document.removeEventListener('click', onOutside);
    if (dropdown.parentNode) dropdown.parentNode.removeChild(dropdown);
    _triggerDropdownCleanup = null;
  };
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

  // ── Row 1: Title boxes + arrows ──
  const titleCells = steps.map((step, i) => {
    const color = getStepColor(step, i);
    const colIdx = i * 2 + 1; // 1-based grid column
    const typeInfo = step.taskType && TASK_TYPE_MAP[step.taskType] ? TASK_TYPE_MAP[step.taskType] : null;
    const badgeHtml = `<span class="qt-type-badge" data-step-id="${step.id}" onclick="toggleTypeDropdown(event,'${step.id}')" title="点击切换任务类型">${typeInfo ? typeInfo.label.split(' ')[0] : '＋类型'}</span>`;
    const arrowCell = i < steps.length - 1
      ? `<div class="tl-arrow-cell" style="grid-column:${colIdx + 1};grid-row:1">→</div>`
      : '';
    return `
      <div class="tl-title-cell" style="grid-column:${colIdx};grid-row:1">
        <div class="tl-title-box" style="background:${color}" onclick="openStepPanel('${step.id}')" title="点击打开属性面板" style="cursor:pointer">
          <div class="tl-title-inner">
            <span>${esc(step.name)}</span>
            ${badgeHtml}
          </div>
        </div>
      </div>
      ${arrowCell}
    `;
  }).join('');

  // ── Row 2: Image（无图时不渲染，grid 自动折叠该行）──
  const imgCells = steps.map((step, i) => {
    const colIdx = i * 2 + 1;
    const imgUrl = getResolvedImageUrl(step.imageUrl || (step.images && step.images[0]) || '');
    const sid = step.id;
    if (!imgUrl) {
      // 无图：渲染一个极小的占位触发区，不占视觉空间
      return `<div class="tl-img-cell tl-img-add" style="grid-column:${colIdx};grid-row:2"
                   onclick="pickStepImage('${sid}')"
                   ondragover="event.preventDefault();this.classList.add('qt-img-drop-hover')"
                   ondragleave="if(!this.contains(event.relatedTarget))this.classList.remove('qt-img-drop-hover')"
                   ondrop="event.preventDefault();this.classList.remove('qt-img-drop-hover');var f=event.dataTransfer.files[0];if(f)saveImageToStep(f,'${sid}')"
                   title="点击或拖入添加图片">＋</div>`;
    }
    return `<div class="tl-img-cell" style="grid-column:${colIdx};grid-row:2">
      <div class="qt-img-zone tl-img-has-img" data-step-id="${sid}"
           ondragover="event.preventDefault();this.classList.add('qt-img-drop-hover')"
           ondragleave="if(!this.contains(event.relatedTarget))this.classList.remove('qt-img-drop-hover')"
           ondrop="event.preventDefault();this.classList.remove('qt-img-drop-hover');var f=event.dataTransfer.files[0];if(f)saveImageToStep(f,'${sid}')"
           title="拖入图片可替换；双击放大">
        <img class="tl-image" src="${esc(imgUrl)}" alt="配图" loading="lazy"
             ondblclick="openImagePreview('${esc(imgUrl)}')" onerror="this.style.display='none'">
        <button class="qt-img-del-btn" onclick="event.stopPropagation();deleteStepImage('${sid}')" title="删除图片">×</button>
      </div>
    </div>`;
  }).join('');

  // ── Row 3: Meta (trigger / location / characters / custom) ──
  const metaCells = steps.map((step, i) => {
    const colIdx = i * 2 + 1;
    const metaItems = [];
    if (step.trigger)    metaItems.push(`<div class="tl-meta-item"><strong>触发：</strong>${esc(step.trigger)}</div>`);
    if (step.location)   metaItems.push(`<div class="tl-meta-item"><strong>位置：</strong>${esc(step.location)}</div>`);
    if (step.characters) metaItems.push(`<div class="tl-meta-item"><strong>人物：</strong>${esc(step.characters)}</div>`);
    (step.customFields || []).forEach(f => {
      if (f.key) metaItems.push(`<div class="tl-meta-item"><strong>${esc(f.key)}：</strong>${esc(f.value)}</div>`);
    });
    return `<div class="tl-meta-cell" style="grid-column:${colIdx};grid-row:3"><div class="tl-meta">${metaItems.join('')}</div></div>`;
  }).join('');

  // ── Row 4: Description ──
  const descCells = steps.map((step, i) => {
    const colIdx = i * 2 + 1;
    return `<div class="tl-desc-cell" style="grid-column:${colIdx};grid-row:4">
      ${step.desc ? `<div class="tl-desc">${escWithBr(step.desc)}</div>` : ''}
    </div>`;
  }).join('');

  $previewCanvas.innerHTML = `
    <div class="timeline-wrap">
      <div class="timeline-title-bar">${esc(title)}</div>
      <div class="tl-grid" style="grid-template-columns:${gridCols}">
        ${titleCells}
        ${imgCells}
        ${metaCells}
        ${descCells}
      </div>
    </div>
  `;

  // 绑定图片区交互
  bindPreviewImageZones($previewCanvas);
}
