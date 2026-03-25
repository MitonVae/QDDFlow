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
 * 截图核心：精确截取 target 元素，与屏幕预览完全一致。
 *
 * 策略：
 * 1. 等所有图片加载完毕
 * 2. 临时解除所有祖先的 overflow 限制，让 html2canvas 能渲染完整内容
 * 3. 截 document.body，用 target 相对于文档的绝对偏移作为裁切区域
 * 4. 截完后还原 overflow
 */
async function _captureNode(target, scale) {
  // 等图片加载完成
  await Promise.all(
    Array.from(target.querySelectorAll('img')).map(img =>
      img.complete
        ? Promise.resolve()
        : new Promise(r => { img.onload = r; img.onerror = r; })
    )
  );

  // 收集并临时解除所有祖先（含 target 自身）的 overflow 限制
  const overflowFixed = [];
  let el = target;
  while (el && el !== document.documentElement) {
    const cs = getComputedStyle(el);
    if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      overflowFixed.push({
        el,
        overflow:  el.style.overflow,
        overflowX: el.style.overflowX,
        overflowY: el.style.overflowY,
      });
      el.style.overflow  = 'visible';
      el.style.overflowX = 'visible';
      el.style.overflowY = 'visible';
    }
    el = el.parentElement;
  }

  // 等浏览器重新布局后再量尺寸
  await new Promise(r => requestAnimationFrame(r));
  await new Promise(r => requestAnimationFrame(r));

  // target 相对于文档左上角的绝对偏移
  // 用 scrollWidth/scrollHeight 获取完整内容尺寸（包含超出滚动区的部分）
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
      backgroundColor: bgColor,
      scale,
      useCORS:     true,
      allowTaint:  true,
      x:           absX,
      y:           absY,
      width:       W,
      height:      H,
      windowWidth:  document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
      scrollX:     0,
      scrollY:     0,
      logging:     false,
    });
  } finally {
    overflowFixed.forEach(({ el, overflow, overflowX, overflowY }) => {
      el.style.overflow  = overflow;
      el.style.overflowX = overflowX;
      el.style.overflowY = overflowY;
    });
  }
  return canvas;
}

async function exportPng() {
  showToast('🖼️ 正在生成图片...');
  const target = document.querySelector('#preview-canvas > *');
  if (!target) { showToast('❌ 没有内容可导出'); return; }
  const titleInput = document.getElementById('questTitle');
  try {
    const canvas = await _captureNode(target, 2);
    const link = document.createElement('a');
    link.download = `QDD_${(titleInput?.value || 'flow').replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
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
  const titleInput = document.getElementById('questTitle');
  try {
    const canvas = await _captureNode(target, 2);
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const { jsPDF } = window.jspdf;
    // canvas 尺寸（px） → pt（1pt = 1px @ 96dpi，jsPDF pt 单位）
    const pdfW = canvas.width  * 0.75;
    const pdfH = canvas.height * 0.75;
    const pdf  = new jsPDF({
      orientation: pdfW >= pdfH ? 'landscape' : 'portrait',
      unit:   'pt',
      format: [pdfW, pdfH],
    });
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
    pdf.save(`QDD_${(titleInput?.value || 'flow').replace(/\s+/g, '_')}.pdf`);
    showToast('✅ PDF 已导出');
  } catch (e) {
    showToast('❌ 导出失败：' + e.message);
    console.error(e);
  }
}

// ===== Backup / Restore JSON =====
function backupJson() {
  const data = JSON.stringify({ qdds: STORE.qdds }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `QDDFlow_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ 备份已下载');
}

function handleRestoreJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!confirm('恢复备份将覆盖当前所有数据，确认继续？')) { e.target.value = ''; return; }
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const parsed = JSON.parse(evt.target.result);
      const qdds = parsed.qdds || (Array.isArray(parsed) ? parsed : null);
      if (!qdds) { showToast('❌ 文件格式不正确'); return; }
      STORE.qdds = qdds;
      saveAllQdds();
      STATE.currentQddId = null;
      STATE.view = 'home';
      savePrefs();
      showHomePage();
      showToast('✅ 恢复成功');
    } catch (err) {
      showToast('❌ 读取失败：' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}