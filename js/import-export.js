// ===== Import Excel/CSV =====
function handleImportFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      if (!rows || rows.length < 2) { showToast('❌ 文件为空或格式不正确'); return; }
      STATE.importHeaders = (rows[0] || []).map(String);
      STATE.importData = rows.slice(1).filter(r => r.some(c => c != null && c !== ''));
      openImportModal();
    } catch (err) {
      showToast('❌ 读取文件失败：' + err.message);
    }
  };
  reader.readAsBinaryString(file);
  e.target.value = '';
}

const FIELD_LABELS = [
  { key: 'name', label: '环节名称' },
  { key: 'trigger', label: '触发方式' },
  { key: 'location', label: '位置' },
  { key: 'characters', label: '出场人物' },
  { key: 'desc', label: '描述' },
  { key: 'imageUrl', label: '配图URL' },
];

function openImportModal() {
  const modal = document.getElementById('import-modal');
  modal.classList.remove('hidden');

  const headerOptions = ['（忽略）', ...STATE.importHeaders].map((h, i) =>
    `<option value="${i === 0 ? '' : STATE.importHeaders[i-1]}">${h}</option>`
  ).join('');

  // Auto-guess mapping
  function guessCol(keywords) {
    for (const kw of keywords) {
      const found = STATE.importHeaders.find(h => h.toLowerCase().includes(kw.toLowerCase()));
      if (found) return found;
    }
    return '';
  }

  const mappings = [
    { key: 'name', label: '环节名称', guess: guessCol(['名称','name','环节','标题']) },
    { key: 'trigger', label: '触发方式', guess: guessCol(['触发','trigger']) },
    { key: 'location', label: '位置', guess: guessCol(['位置','location','地点']) },
    { key: 'characters', label: '出场人物', guess: guessCol(['人物','character','出场','角色']) },
    { key: 'desc', label: '描述', guess: guessCol(['描述','desc','说明','内容','剧情']) },
    { key: 'imageUrl', label: '配图URL', guess: guessCol(['图','image','url','img','配图']) },
  ];

  const rowsHtml = mappings.map(m => {
    const opts = STATE.importHeaders.map(h =>
      `<option value="${esc(h)}" ${h === m.guess ? 'selected' : ''}>${esc(h)}</option>`
    ).join('');
    return `
      <div class="import-map-row">
        <label>${m.label}</label>
        <select id="map-${m.key}">
          <option value="">（忽略）</option>
          ${opts}
        </select>
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="import-modal-box">
      <h3>📂 Excel/CSV 列映射（共 ${STATE.importData.length} 行数据，${STATE.importHeaders.length} 列）</h3>
      <div class="import-modal-body">
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">请将文件列名与QDD字段对应。已自动识别，可手动调整：</p>
        ${rowsHtml}
      </div>
      <div class="import-modal-footer">
        <button class="btn-cancel" onclick="closeImportModal()">取消</button>
        <button class="btn-primary" onclick="confirmImport()">导入</button>
      </div>
    </div>
  `;
}

function closeImportModal() {
  document.getElementById('import-modal').classList.add('hidden');
  STATE.importData = null;
  STATE.importHeaders = [];
}

function confirmImport() {
  const mapping = {};
  FIELD_LABELS.forEach(f => {
    const sel = document.getElementById('map-' + f.key);
    if (sel) mapping[f.key] = sel.value;
  });

  const getCol = (row, colName) => {
    if (!colName) return '';
    const i = STATE.importHeaders.indexOf(colName);
    return i >= 0 && row[i] != null ? String(row[i]).trim() : '';
  };

  const newSteps = STATE.importData.map((row, ri) => ({
    id: genId(),
    name: getCol(row, mapping.name) || `环节${ri + 1}`,
    trigger: getCol(row, mapping.trigger),
    location: getCol(row, mapping.location),
    characters: getCol(row, mapping.characters),
    desc: getCol(row, mapping.desc),
    imageUrl: getCol(row, mapping.imageUrl),
    color: PRESET_COLORS[ri % PRESET_COLORS.length],
    customFields: [],
  }));

  STATE.steps = newSteps;
  closeImportModal();
  renderAll();
  showToast(`✅ 成功导入 ${newSteps.length} 个环节`);
}

// ===== Export PNG / PDF =====

/**
 * 对 target 节点截图，与屏幕预览像素级一致。
 *
 * 策略：
 * 1. 等待所有图片加载完毕
 * 2. 临时解除 target 及所有祖先的 overflow / flex-height 限制，
 *    使 html2canvas 能看到超出滚动区的完整内容
 * 3. 用 target 的绝对文档坐标 + scrollWidth/scrollHeight 截图
 * 4. 截完立即还原所有样式
 */
async function _captureNode(target, scale) {
  // 1. 等所有图片加载
  await Promise.all(
    Array.from(target.querySelectorAll('img')).map(img =>
      img.complete ? Promise.resolve()
        : new Promise(r => { img.onload = r; img.onerror = r; })
    )
  );

  // 2. 导出前隐藏所有标记了 data-export-hide 的元素（如无图占位区）
  const hidden = Array.from(target.querySelectorAll('[data-export-hide]'));
  hidden.forEach(el => { el._prevDisplay = el.style.display; el.style.display = 'none'; });

  // 3. 临时解除祖先的 overflow / height 限制
  const restored = [];
  let el = target.parentElement;
  while (el && el !== document.documentElement) {
    const s = el.style;
    const cs = getComputedStyle(el);
    const entry = { el, overflow: s.overflow, overflowX: s.overflowX, overflowY: s.overflowY, height: s.height, maxHeight: s.maxHeight };
    let changed = false;
    if (cs.overflow !== 'visible')  { s.overflow  = 'visible'; changed = true; }
    if (cs.overflowX !== 'visible') { s.overflowX = 'visible'; changed = true; }
    if (cs.overflowY !== 'visible') { s.overflowY = 'visible'; changed = true; }
    if (cs.height !== 'auto' && (el.style.height || cs.height === '0px')) {
      s.height = 'auto'; changed = true;
    }
    if (changed) restored.push(entry);
    el = el.parentElement;
  }

  // 4. 等浏览器重排
  await new Promise(r => requestAnimationFrame(r));
  await new Promise(r => requestAnimationFrame(r));

  // 5. 量取坐标和尺寸
  const rect = target.getBoundingClientRect();
  const absX = Math.round(rect.left + window.scrollX);
  const absY = Math.round(rect.top  + window.scrollY);
  const W    = Math.ceil(target.scrollWidth);
  const H    = Math.ceil(target.scrollHeight);

  const bgColor = getComputedStyle(document.getElementById('preview-area') || document.body)
    .backgroundColor || '#ffffff';

  let canvas;
  try {
    canvas = await html2canvas(document.body, {
      backgroundColor:  bgColor,
      scale,
      useCORS:          true,
      allowTaint:       true,
      x:                absX,
      y:                absY,
      width:            W,
      height:           H,
      windowWidth:      document.documentElement.scrollWidth,
      windowHeight:     document.documentElement.scrollHeight,
      scrollX:          0,
      scrollY:          0,
      logging:          false,
    });
  } finally {
    // 6. 还原隐藏的元素
    hidden.forEach(el => { el.style.display = el._prevDisplay || ''; delete el._prevDisplay; });
    // 7. 还原 overflow / height
    restored.forEach(({ el, overflow, overflowX, overflowY, height, maxHeight }) => {
      el.style.overflow  = overflow;
      el.style.overflowX = overflowX;
      el.style.overflowY = overflowY;
      el.style.height    = height;
      el.style.maxHeight = maxHeight;
    });
  }
  return canvas;
}

async function exportPng() {
  showToast('🖼️ 正在生成图片...');
  const target = document.querySelector('#preview-canvas > *');
  if (!target) { showToast('❌ 没有内容可导出'); return; }
  const title = document.getElementById('questTitle')?.value || 'flow';
  try {
    const canvas = await _captureNode(target, 2);
    const a = document.createElement('a');
    a.download = `QDD_${title.replace(/\s+/g, '_')}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    showToast('✅ PNG 已导出');
  } catch (e) {
    showToast('❌ 导出失败：' + e.message);
    console.error(e);
  }
}

async function exportPdf() {
  showToast('📄 正在生成PDF...');
  const target = document.querySelector('#preview-canvas > *');
  if (!target) { showToast('❌ 没有内容可导出'); return; }
  const title = document.getElementById('questTitle')?.value || 'flow';
  try {
    const canvas = await _captureNode(target, 2);
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const { jsPDF } = window.jspdf;
    const pdfW = canvas.width  * 0.75;
    const pdfH = canvas.height * 0.75;
    const pdf  = new jsPDF({
      orientation: pdfW >= pdfH ? 'landscape' : 'portrait',
      unit:   'pt',
      format: [pdfW, pdfH],
    });
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
    pdf.save(`QDD_${title.replace(/\s+/g, '_')}.pdf`);
    showToast('✅ PDF 已导出');
  } catch (e) {
    showToast('❌ 导出失败：' + e.message);
    console.error(e);
  }
}

// ===== Backup / Restore JSON（保留供 AI 导出下载功能调用）=====
// exportCurrentQddAsJson 已移入 ai-import.js 的下载逻辑，此处留空