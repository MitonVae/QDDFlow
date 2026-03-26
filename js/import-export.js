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
 * 截图核心。
 *
 * 难点：html2canvas 在 windowWidth != 真实视口宽时会重新布局，
 * 导致边框错位；但如果用原始 DOM 截图，overflow 裁剪会漏掉内容。
 * 解决：克隆 DOM + 锁定每个节点尺寸（保持布局），
 * 但 <img> 不锁尺寸而是提前把图片内容画到 <canvas> 上（保持比例+白底留白），
 * 截图完成后还原。
 */
async function _captureNode(target, scale) {

  // 1. 等所有图片加载
  await Promise.all(
    Array.from(target.querySelectorAll('img')).map(img =>
      img.complete ? Promise.resolve()
        : new Promise(r => { img.onload = r; img.onerror = r; })
    )
  );

  // 2. 把原始 DOM 里每个 <img> 替换成按正确比例绘制的 <canvas>
  //    记录替换关系，截完后还原
  const imgSwaps = [];
  target.querySelectorAll('img').forEach(img => {
    const containerW = img.offsetWidth;
    const containerH = img.offsetHeight;
    if (!containerW || !containerH) return;

    const natW = img.naturalWidth  || containerW;
    const natH = img.naturalHeight || containerH;

    const canvas = document.createElement('canvas');
    canvas.width  = containerW * scale;
    canvas.height = containerH * scale;
    const ctx = canvas.getContext('2d');

    // 白色底
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // contain：按比例缩放，居中
    const ratio   = Math.min(canvas.width / natW, canvas.height / natH);
    const drawW   = natW * ratio;
    const drawH   = natH * ratio;
    const drawX   = (canvas.width  - drawW) / 2;
    const drawY   = (canvas.height - drawH) / 2;
    ctx.drawImage(img, drawX, drawY, drawW, drawH);

    // 让 canvas 在页面里占同等空间
    canvas.style.cssText = `width:${containerW}px;height:${containerH}px;display:block;`;

    img.parentNode.insertBefore(canvas, img);
    img.style.display = 'none';
    imgSwaps.push({ img, canvas });
  });

  const srcW = target.scrollWidth;

  // 3. 离屏克隆
  const offscreen = document.createElement('div');
  offscreen.style.cssText =
    `position:fixed;top:0;left:-99999px;width:${srcW}px;height:auto;` +
    'overflow:visible;z-index:-1;pointer-events:none;';

  const clone = target.cloneNode(true);
  clone.style.cssText += `;width:${srcW}px;height:auto;overflow:visible;position:static;transform:none;`;

  // 4. 锁定克隆中每个节点的尺寸（<canvas> 已经是正确尺寸，直接锁；<img> 已隐藏不用管）
  const srcNodes   = [target, ...target.querySelectorAll('*')];
  const cloneNodes = [clone,  ...clone.querySelectorAll('*')];
  srcNodes.forEach((src, i) => {
    const dst = cloneNodes[i];
    if (!dst) return;
    const rect = src.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    dst.style.width      = rect.width  + 'px';
    dst.style.height     = rect.height + 'px';
    dst.style.minWidth   = rect.width  + 'px';
    dst.style.minHeight  = rect.height + 'px';
    dst.style.maxWidth   = rect.width  + 'px';
    dst.style.maxHeight  = rect.height + 'px';
    dst.style.boxSizing  = 'border-box';
    dst.style.flexShrink = '0';
    dst.style.flexGrow   = '0';
    dst.style.overflow   = 'visible';
    dst.style.overflowX  = 'visible';
    dst.style.overflowY  = 'visible';
  });

  // 隐藏导出时不需要的元素
  clone.querySelectorAll('[data-export-hide]').forEach(el => { el.style.display = 'none'; });

  offscreen.appendChild(clone);
  document.body.appendChild(offscreen);

  await new Promise(r => requestAnimationFrame(r));
  await new Promise(r => requestAnimationFrame(r));

  const cloneW = clone.scrollWidth;
  const cloneH = clone.scrollHeight;

  const bgColor = '#ffffff';

  let canvas;
  try {
    canvas = await html2canvas(clone, {
      backgroundColor: bgColor,
      scale,
      useCORS:      true,
      allowTaint:   true,
      x:            0,
      y:            0,
      width:        cloneW,
      height:       cloneH,
      windowWidth:  cloneW,
      windowHeight: cloneH,
      scrollX:      0,
      scrollY:      0,
      logging:      false,
    });
  } finally {
    // 5. 还原：删离屏容器，恢复原始 img
    document.body.removeChild(offscreen);
    imgSwaps.forEach(({ img, canvas: c }) => {
      img.style.display = '';
      if (c.parentNode) c.parentNode.removeChild(c);
    });
  }
  return canvas;
}

  try {
    const canvas = await html2canvas(clone, {
      backgroundColor: bgColor,
      scale,
      useCORS:     true,
      allowTaint:  true,
      x:           0,
      y:           0,
      width:       cloneW,
      height:      cloneH,
      windowWidth:  cloneW,
      windowHeight: cloneH,
      scrollX:     0,
      scrollY:     0,
      logging:     false,
    });
    return canvas;
  } finally {
    document.body.removeChild(offscreen);
  }
}

async function exportPng() {
  showToast('🖼️ 正在生成图片...');
  const target = document.querySelector('#preview-canvas > *');
  if (!target) { showToast('❌ 没有内容可导出'); return; }
  const titleInput = document.getElementById('questTitle');
  const filename = `QDD_${(titleInput?.value || 'flow').replace(/\s+/g, '_')}.png`;
  log.info('exportPng: 开始，target=', target.tagName, 'filename=', filename);
  try {
    const canvas = await _captureNode(target, 2);
    log.info('exportPng: 截图完成，尺寸=', canvas.width, 'x', canvas.height);
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('✅ PNG 已导出');
  } catch (e) {
    log.error('exportPng: 失败', e);
    showToast('❌ 导出失败：' + e.message);
  }
}

async function exportPdf() {
  showToast('📄 正在生成PDF...');
  const target = document.querySelector('#preview-canvas > *');
  if (!target) { showToast('❌ 没有内容可导出'); return; }
  const titleInput = document.getElementById('questTitle');
  const filename = `QDD_${(titleInput?.value || 'flow').replace(/\s+/g, '_')}.pdf`;
  log.info('exportPdf: 开始，filename=', filename);
  try {
    const canvas = await _captureNode(target, 2);
    log.info('exportPdf: 截图完成，尺寸=', canvas.width, 'x', canvas.height);
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const { jsPDF } = window.jspdf;
    if (!jsPDF) throw new Error('jsPDF 库未加载');
    const pdfW = canvas.width  * 0.75;
    const pdfH = canvas.height * 0.75;
    const pdf  = new jsPDF({
      orientation: pdfW >= pdfH ? 'landscape' : 'portrait',
      unit:   'pt',
      format: [pdfW, pdfH],
    });
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH);
    pdf.save(filename);
    showToast('✅ PDF 已导出');
  } catch (e) {
    log.error('exportPdf: 失败', e);
    showToast('❌ 导出失败：' + e.message);
  }
}

// ===== 标题链复制 =====
/**
 * 把所有环节名称用 ` → ` 连接成一行文字，复制到剪贴板。
 * 示例：0.任务接取 → 1.武康大楼 → 2.对话门卫
 */
function copyTitleChain() {
  if (!STATE.steps || STATE.steps.length === 0) {
    showToast('⚠️ 没有环节可导出');
    return;
  }
  const chain = STATE.steps.map(s => s.name || '未命名').join(' → ');
  log.info('copyTitleChain:', chain.slice(0, 60));

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(chain)
      .then(() => showToast('✅ 标题链已复制！'))
      .catch(() => _fallbackCopyText(chain));
  } else {
    _fallbackCopyText(chain);
  }
}

function _fallbackCopyText(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-9999px;opacity:0;';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast('✅ 标题链已复制！');
  } catch(e) {
    showToast('❌ 复制失败，请手动复制');
    log.error('_fallbackCopyText:', e);
  }
  document.body.removeChild(ta);
}

// ===== Backup / Restore JSON（保留供 AI 导出下载功能调用）=====
// exportCurrentQddAsJson 已移入 ai-import.js 的下载逻辑，此处留空
