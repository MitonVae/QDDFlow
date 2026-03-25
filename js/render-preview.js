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

    // ── Image: support multiple images ──
    const imgs = step.images && step.images.length > 0
      ? step.images
      : (step.imageUrl ? [step.imageUrl] : []);
    const imgInner = imgs.length > 0
      ? imgs.map((url, ii) => `
          <div class="qt-img-zone qt-img-has-img qt-img-thumb" data-step-id="${step.id}" tabindex="0"
               title="双击放大" ondblclick="openImagePreview('${esc(url)}')">
            <img src="${esc(url)}" loading="lazy" onerror="this.style.display='none'">
          </div>`).join('')
      : '';
    const img = `<div class="qt-col-img qt-img-zone${imgs.length === 0 ? ' qt-col-img-empty' : ''} qt-img-multi-wrap" data-step-id="${step.id}" tabindex="0">
      ${imgInner}
      ${imgs.length === 0 ? '<span class="qt-img-empty-hint">� 拖入或 Ctrl+V 粘贴图片</span>' : ''}
    </div>`;

    // ── Fields: nested 2-col table [label | value] — skip empty rows ──
    const fieldRows = fieldDefs.map(fd => {
      const val = fd.custom ? (customMap[fd.field] || '') : (step[fd.field] || '');
      if (fd.type === 'trigger-select') {
        // Always show trigger row (allows clicking to set); if empty show placeholder
        const displayVal = val || '—';
        return `<tr>
          <td class="qt-fl">${esc(fd.label)}：</td>
          <td class="qt-fv qt-fv-select" data-step-id="${step.id}" data-field="trigger"
              onclick="toggleTriggerDropdown(event,'${step.id}')" title="点击选择触发方式">${esc(displayVal)}<span class="qt-select-arrow">▾</span></td>
        </tr>`;
      }
      // Skip row entirely if value is empty
      if (!val) return '';
      return `<tr>
        <td class="qt-fl">${esc(fd.label)}：</td>
        <td class="qt-fv" contenteditable="true"
          data-step-id="${step.id}" data-field="${fd.field}"
          data-custom="${fd.custom ? '1' : '0'}">${esc(val)}</td>
      </tr>`;
    }).join('');
    const fields = `<table class="qt-fields-table" cellspacing="0" cellpadding="0">${fieldRows}</table>`;

    // ── Description ──
    const desc = `<div class="qt-col-desc" contenteditable="true"
      data-step-id="${step.id}" data-field="desc">${escWithBr(step.desc || '')}</div>`;

    return `<td class="qt-step-cell" valign="top">
      <div class="qt-step-inner">${header}${img}${fields}${desc}</div>
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

  // Bind inline image drop zones
  bindInlineImageZones($previewCanvas);
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
    const inner = imgs.length > 0
      ? imgs.map(url => `<img src="${h(url)}" style="max-width:160px;max-height:110px;display:inline-block;margin:2px;">`).join('')
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

  // ── Row 2: Images (multi-image support) ──
  const imgCells = steps.map((step, i) => {
    const colIdx = i * 2 + 1;
    const imgs = step.images && step.images.length > 0
      ? step.images
      : (step.imageUrl ? [step.imageUrl] : []);
    let imgHtml;
    if (imgs.length === 0) {
      imgHtml = `<div class="tl-image-placeholder" data-step-id="${step.id}">
          <span>📷 在属性面板添加配图</span>
        </div>`;
    } else if (imgs.length === 1) {
      imgHtml = `<img class="tl-image" src="${esc(imgs[0])}" alt="配图" loading="lazy"
          ondblclick="openImagePreview('${esc(imgs[0])}')" title="双击放大">`;
    } else {
      // Multiple: horizontal scroll strip
      const thumbs = imgs.map(url => `
        <img class="tl-image-thumb" src="${esc(url)}" alt="" loading="lazy"
          ondblclick="openImagePreview('${esc(url)}')" title="双击放大">`).join('');
      imgHtml = `<div class="tl-multi-img-strip">${thumbs}</div>`;
    }
    return `<div class="tl-img-cell" style="grid-column:${colIdx};grid-row:2">${imgHtml}</div>`;
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

  // Bind inline image drop zones
  bindInlineImageZones($previewCanvas);
}