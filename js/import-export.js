    const cs = getComputedStyle(node);
    if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
      overflowNodes.push({ el: node, overflow: node.style.overflow, overflowX: node.style.overflowX, overflowY: node.style.overflowY });
      node.style.overflow  = 'visible';
      node.style.overflowX = 'visible';
      node.style.overflowY = 'visible';
    }
  });

  // 2. 绛変竴甯ц娴忚鍣ㄩ噸鏂拌绠楀竷灞€
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
    // 3. 杩樺師 overflow
    overflowNodes.forEach(({ el, overflow, overflowX, overflowY }) => {
      el.style.overflow  = overflow;
      el.style.overflowX = overflowX;
      el.style.overflowY = overflowY;
    });
  }
}

async function exportPng() {
  showToast('馃柤锔?姝ｅ湪鐢熸垚鍥剧墖...');
  const previewCanvas = document.getElementById('preview-canvas');
  const target = previewCanvas && previewCanvas.firstElementChild;
  if (!target) { showToast('鉂?娌℃湁鍐呭鍙鍑?); return; }
  const titleInput = document.getElementById('questTitle');
  try {
    const canvas = await _captureNode(target, 2);
    const link = document.createElement('a');
    link.download = `QDD_${(titleInput?.value || 'flow').replace(/\s+/g, '_')}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('鉁?PNG 宸插鍑?);
  } catch (e) {
    showToast('鉂?瀵煎嚭澶辫触锛? + e.message);
  }
}

// ===== Export PDF =====
async function exportPdf() {
  showToast('馃搫 姝ｅ湪鐢熸垚PDF...');
  const previewCanvas = document.getElementById('preview-canvas');
  const target = previewCanvas && previewCanvas.firstElementChild;
  if (!target) { showToast('鉂?娌℃湁鍐呭鍙鍑?); return; }
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
    showToast('鉁?PDF 宸插鍑?);
  } catch (e) {
    showToast('鉂?瀵煎嚭澶辫触锛? + e.message);
  }
}

// ===== Toast =====
let toastTimer = null;
}

function handleRestoreJson(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const payload = JSON.parse(ev.target.result);
      const qdds = payload.qdds || payload; // support both wrapped and raw array
      if (!Array.isArray(qdds)) throw new Error('鏍煎紡涓嶅');
      if (!confirm(`纭鐢ㄥ浠芥枃浠惰鐩栧綋鍓嶆墍鏈?QDD 鏁版嵁锛燂紙鍏?${qdds.length} 涓?QDD锛塡n姝ゆ搷浣滀笉鍙挙閿€銆俙)) return;
      // Push current state to history before overwriting
      pushHistory();
      STORE.qdds = qdds;
      saveAllQdds();
      showToast(`鉁?宸叉仮澶?${qdds.length} 涓?QDD`);
      // Go back to home to re-select
      showHomePage();
    } catch(err) {
      alert('璇诲彇澶囦唤澶辫触锛? + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // reset for re-select
}

// ===== View: Home Page =====
function showHomePage() {
  // Save current QDD state before leaving editor
  if (STATE.currentQddId) {
    const qdd = getCurrentQdd();
    if (qdd) syncQddFromState(qdd);
    saveAllQdds();
  }
  STATE.currentQddId = null;
  STATE.view = 'home';
  savePrefs(); // persist view=home so refresh stays on home

  document.getElementById('app').innerHTML = buildHomePageHTML();
  document.getElementById('newQddBtn').addEventListener('click', createNewQdd);
  // Bind theme select for home page
  const $ts = document.getElementById('themeSelect');
  if ($ts) { $ts.value = STATE.theme; $ts.addEventListener('change', e => { applyTheme(e.target.value); savePrefs(); }); }
  renderQddCards();
}

function buildHomePageHTML() {
  return `
  { key: 'name', label: '鐜妭鍚嶇О' },
  { key: 'trigger', label: '瑙﹀彂鏂瑰紡' },
  { key: 'location', label: '浣嶇疆' },
  { key: 'characters', label: '鍑哄満浜虹墿' },
  { key: 'desc', label: '鎻忚堪' },
  { key: 'imageUrl', label: '閰嶅浘URL' },
];

function openImportModal() {
  const modal = document.getElementById('import-modal');
  modal.classList.remove('hidden');

  const headerOptions = ['锛堝拷鐣ワ級', ...STATE.importHeaders].map((h, i) =>
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
    { key: 'name', label: '鐜妭鍚嶇О', guess: guessCol(['鍚嶇О','name','鐜妭','鏍囬']) },
    { key: 'trigger', label: '瑙﹀彂鏂瑰紡', guess: guessCol(['瑙﹀彂','trigger']) },
    { key: 'location', label: '浣嶇疆', guess: guessCol(['浣嶇疆','location','鍦扮偣']) },
    { key: 'characters', label: '鍑哄満浜虹墿', guess: guessCol(['浜虹墿','character','鍑哄満','瑙掕壊']) },
    { key: 'desc', label: '鎻忚堪', guess: guessCol(['鎻忚堪','desc','璇存槑','鍐呭','鍓ф儏']) },
    { key: 'imageUrl', label: '閰嶅浘URL', guess: guessCol(['鍥?,'image','url','img','閰嶅浘']) },
  ];

  const rowsHtml = mappings.map(m => {
    const opts = STATE.importHeaders.map(h =>
      `<option value="${esc(h)}" ${h === m.guess ? 'selected' : ''}>${esc(h)}</option>`
    ).join('');
    return `
      <div class="import-map-row">
        <label>${m.label}</label>
        <select id="map-${m.key}">
          <option value="">锛堝拷鐣ワ級</option>
          ${opts}
        </select>
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="import-modal-box">
      <h3>馃搨 Excel/CSV 鍒楁槧灏勶紙鍏?${STATE.importData.length} 琛屾暟鎹紝${STATE.importHeaders.length} 鍒楋級</h3>
      <div class="import-modal-body">
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">璇峰皢鏂囦欢鍒楀悕涓嶲DD瀛楁瀵瑰簲銆傚凡鑷姩璇嗗埆锛屽彲鎵嬪姩璋冩暣锛?/p>
        ${rowsHtml}
      </div>
      <div class="import-modal-footer">
        <button class="btn-cancel" onclick="closeImportModal()">鍙栨秷</button>
        <button class="btn-primary" onclick="confirmImport()">瀵煎叆</button>
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
    name: getCol(row, mapping.name) || `鐜妭${ri + 1}`,
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
  showToast(`鉁?鎴愬姛瀵煎叆 ${newSteps.length} 涓幆鑺俙);
}

// ===== Export PNG =====
// ===== Export helpers =====
/**
 * 瀵圭洰鏍囪妭鐐规埅鍥俱€? * 鍋氭硶锛氫复鏃舵妸 preview-area 鍜屽叾婊氬姩绁栧厛鐨?overflow 瑙ｉ櫎锛屾埅瀹屽啀杩樺師锛? * 閬垮厤 overflow:auto 鎴浘鍋忕Щ 鍜?flex height:100% 楂樺害濉岄櫡闂銆? */
async function _captureNode(target, scale) {
  const bgColor = getComputedStyle(document.getElementById('preview-area') || document.body)
    .backgroundColor || '#ffffff';

  // 1. 鏀堕泦骞朵复鏃惰В闄ゆ墍鏈夌鍏堝拰 target 鍐呴儴鐨?overflow 闄愬埗
  const overflowNodes = [];
  // 绁栧厛
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
  // target 鑷韩鍙婂唴閮?  [target, ...target.querySelectorAll('*')].forEach(node => {
    const cs = getComputedStyle(node);
