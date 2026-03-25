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

// ===== Export PNG =====
// ===== Export helpers =====
/**
 * 对目标节点截图。
 * 做法：临时把 preview-area 和其滚动祖先的 overflow 解除，截完再还原，
 * 避免 overflow:auto 截图偏移 和 flex height:100% 高度塌陷问题。
 */
async function _captureNode(target, scale) {
  const bgColor = getComputedStyle(document.getElementById('preview-area') || document.body)
    .backgroundColor || '#ffffff';

  // 1. 只临时解除「target 的祖先」的 overflow 裁切，
  //    不动 target 内部——否则会破坏 table/flex 布局导致边框错位和图片拉伸
  const overflowNodes = [];
  let el = target.parentElement;
  while (el && el !== document.body) {
    const cs = getComputedStyle(el);
    if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      overflowNodes.push({
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

  // 2. 等待 target 内所有图片加载完毕
  const imgs = Array.from(target.querySelectorAll('img'));
  await Promise.all(imgs.map(img =>
    img.complete ? Promise.resolve() : new Promise(r => {
      img.addEventListener('load',  r, { once: true });
      img.addEventListener('error', r, { once: true });
    })
  ));

  // 3. 等两帧让浏览器重新计算布局
  await new Promise(r => requestAnimationFrame(r));
  await new Promise(r => requestAnimationFrame(r));

  // 4. 用 getBoundingClientRect 获取 target 真实渲染尺寸
  const rect = target.getBoundingClientRect();
  const W = Math.ceil(rect.width);
  const H = Math.ceil(rect.height);

  try {
    const canvas = await html2canvas(target, {
      backgroundColor: bgColor,
      scale,
      useCORS: true,
      allowTaint: true,
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      width:  W,
      height: H,
      windowWidth:  document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight,
      logging: false,
    });
    return canvas;
  } finally {
    // 4. 还原祖先 overflow
    overflowNodes.forEach(({ el, overflow, overflowX, overflowY }) => {
      el.style.overflow  = overflow;
      el.style.overflowX = overflowX;
      el.style.overflowY = overflowY;
    });
  }
}

async function exportPng() {
  showToast('🖼️ 正在生成图片...');
  const previewCanvas = document.getElementById('preview-canvas');
  const target = previewCanvas && previewCanvas.firstElementChild;
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
  }
}

// ===== Export PDF =====
async function exportPdf() {
  showToast('📄 正在生成PDF...');
  const previewCanvas = document.getElementById('preview-canvas');
  const target = previewCanvas && previewCanvas.firstElementChild;
  if (!target) { showToast('❌ 没有内容可导出'); return; }
  const titleInput = document.getElementById('questTitle');
  try {
    const canvas = await _captureNode(target, 1.5);
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const { jsPDF } = window.jspdf;
    const pw = canvas.width;
    const ph = canvas.height;
    const pdfScale = 0.264583;
    const pdfW = pw * pdfScale;
    const pdfH = ph * pdfScale;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [pdfW, pdfH] });
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
    pdf.save(`QDD_${(titleInput?.value || 'flow').replace(/\s+/g, '_')}.pdf`);
    showToast('✅ PDF 已导出');
  } catch (e) {
    showToast('❌ 导出失败：' + e.message);
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
