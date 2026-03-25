
// ===== JSON Backup / Restore =====
function exportBackupJson() {
  // Sync current state before export
  const qdd = getCurrentQdd();
  if (qdd) syncQddFromState(qdd);

  const payload = {
    _version: 1,
    _exportedAt: new Date().toISOString(),
    qdds: STORE.qdds,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const ts   = new Date().toISOString().slice(0,16).replace(/[T:]/g, '-');
  a.href     = url;
  a.download = `QDDFlow_backup_${ts}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✓ 备份已导出');
}

function handleRestoreJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const payload = JSON.parse(ev.target.result);
      const qdds = payload.qdds || payload; // support both wrapped and raw array
      if (!Array.isArray(qdds)) throw new Error('格式不对');
      if (!confirm(`确认用备份文件覆盖当前所有 QDD 数据？（共 ${qdds.length} 个 QDD）\n此操作不可撤销。`)) return;
      // Push current state to history before overwriting
      pushHistory();
      STORE.qdds = qdds;
      saveAllQdds();
      showToast(`✓ 已恢复 ${qdds.length} 个 QDD`);
      // Go back to home to re-select
      showHomePage();
    } catch(err) {
      alert('读取备份失败：' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // reset for re-select
}

// ===== View: Home Page =====
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

  // 1. 收集并临时解除所有祖先和 target 内部的 overflow 限制
  const overflowNodes = [];
  // 祖先
  let el = target.parentElement;
  while (el && el !== document.body) {
    const cs = getComputedStyle(el);
    if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      overflowNodes.push({ el, overflow: el.style.overflow, overflowX: el.style.overflowX, overflowY: el.style.overflowY });
      el.style.overflow = 'visible';
      el.style.overflowX = 'visible';
      el.style.overflowY = 'visible';
    }
    el = el.parentElement;
  }
  // target 自身及内部
  [target, ...target.querySelectorAll('*')].forEach(node => {
    const cs = getComputedStyle(node);
    if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      overflowNodes.push({ el: node, overflow: node.style.overflow, overflowX: node.style.overflowX, overflowY: node.style.overflowY });
      node.style.overflow  = 'visible';
      node.style.overflowX = 'visible';
      node.style.overflowY = 'visible';
    }
  });

  // 2. 等一帧让浏览器重新计算布局
  await new Promise(r => requestAnimationFrame(r));

  const W = target.scrollWidth;
  const H = target.scrollHeight;

  try {
    const canvas = await html2canvas(target, {
      backgroundColor: bgColor,
      scale,
      useCORS: true,
      allowTaint: true,
      scrollX: -window.scrollX,
      scrollY: -window.scrollY,
      x: 0,
      y: 0,
      width:  W,
      height: H,
      windowWidth:  W,
      windowHeight: H,
      logging: false,
    });
    return canvas;
  } finally {
    // 3. 还原 overflow
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