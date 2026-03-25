// ===== QDD 分享链接 =====
//
// 格式：https://mitonvae.github.io/QDDFlow/#share=<compressed-base64url>
//
// 编码流程：QDD JSON → UTF-8字节 → deflate-raw压缩 → base64url
// 解码流程：base64url → inflate-raw解压 → UTF-8字符串 → JSON.parse
//
// 注意：图片若是 idb: 引用则无法分享（跨浏览器无共享 IndexedDB），
// 分享时自动把 idb: 图片转成 base64 内嵌，或提示图片较大时截断。

// ── 压缩工具 ──
async function _compress(str) {
  const bytes = new TextEncoder().encode(str);
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const buf = await new Response(cs.readable).arrayBuffer();
  const arr = new Uint8Array(buf);
  // 用循环拼接，避免 spread 展开大数组时栈溢出
  let bin = '';
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function _decompress(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const buf = await new Response(ds.readable).arrayBuffer();
  return new TextDecoder().decode(buf);
}

// ── 解析 idb: 图片为 base64（分享时内嵌）──
async function _resolveQddImagesForShare(qdd) {
  const resolved = JSON.parse(JSON.stringify(qdd)); // 深拷贝，不改原数据
  for (const step of (resolved.steps || [])) {
    if (step.imageUrl && step.imageUrl.startsWith('idb:')) {
      const dataUrl = await loadImageFromDb(step.imageUrl).catch(() => null);
      step.imageUrl = dataUrl || '';
      step.images   = step.imageUrl ? [step.imageUrl] : [];
    }
  }
  return resolved;
}

// ── 生成分享链接 ──
async function generateShareLink(qddId) {
  const qdd = STORE.qdds.find(q => q.id === qddId);
  if (!qdd) { showToast('❌ 找不到该 QDD'); return null; }

  showToast('⏳ 正在生成分享链接...');
  try {
    const qddToShare = await _resolveQddImagesForShare(qdd);
    const json = JSON.stringify(qddToShare);
    const compressed = await _compress(json);

    // 粗略估计 URL 长度（超过 50KB 提示图片太大）
    if (compressed.length > 50000) {
      showToast('⚠️ 含图片链接较长，建议分享时删除图片或使用"导出PNG"代替');
    }

    const base = window.location.origin + window.location.pathname;
    const url  = base + '#share=' + compressed;
    return url;
  } catch (e) {
    showToast('❌ 生成分享链接失败：' + e.message);
    console.error(e);
    return null;
  }
}

// ── 打开分享弹窗 ──
async function openShareDialog(qddId) {
  const url = await generateShareLink(qddId);
  if (!url) return;

  // 创建弹窗
  const old = document.getElementById('share-modal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'share-modal';
  modal.className = 'share-modal-overlay';
  modal.innerHTML = `
    <div class="share-modal-box">
      <div class="share-modal-header">
        <span>🔗 分享此 QDD</span>
        <button onclick="document.getElementById('share-modal').remove()">×</button>
      </div>
      <div class="share-modal-body">
        <p class="share-modal-hint">将下面的链接发给任何人，他们打开即可查看此 QDD（只读预览）：</p>
        <textarea id="share-url-box" class="share-url-textarea" readonly>${url}</textarea>
        <div class="share-modal-actions">
          <button class="btn-primary" onclick="copyShareLink()">📋 复制链接</button>
          <button class="btn-cancel" onclick="document.getElementById('share-modal').remove()">关闭</button>
        </div>
        <p class="share-modal-note">💡 对方无需登录，直接用链接即可查看。含图片的链接较长属正常现象。</p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  // 自动全选
  setTimeout(() => {
    const box = document.getElementById('share-url-box');
    if (box) box.select();
  }, 50);
}

function copyShareLink() {
  const box = document.getElementById('share-url-box');
  if (!box) return;
  navigator.clipboard.writeText(box.value).then(() => {
    showToast('✅ 链接已复制！');
  }).catch(() => {
    box.select();
    document.execCommand('copy');
    showToast('✅ 链接已复制！');
  });
}

// ── 只读预览模式：从 URL hash 加载 QDD ──
async function tryLoadSharedQdd() {
  const hash = window.location.hash;
  if (!hash.startsWith('#share=')) return false;

  const encoded = hash.slice('#share='.length);
  if (!encoded) return false;

  try {
    const json = await _decompress(encoded);
    const qdd  = JSON.parse(json);
    if (!qdd || !Array.isArray(qdd.steps)) throw new Error('数据格式不正确');

    // 进入只读预览
    _enterReadonlyPreview(qdd);
    return true;
  } catch (e) {
    showToast('❌ 分享链接无法解析：' + e.message);
    console.error(e);
    return false;
  }
}

function _enterReadonlyPreview(qdd) {
  STATE.currentQddId = null; // 不存入 localStorage
  STATE.view = 'share';
  STATE.questTitle = qdd.title || '分享的 QDD';
  STATE.steps = qdd.steps || [];
  STATE.layout = loadPrefs().layout; // 保留用户偏好的布局
  applyTheme(loadPrefs().theme);

  document.getElementById('app').innerHTML = `
    <header id="toolbar">
      <div class="toolbar-left">
        <span class="app-title">QDD Flow</span>
        <span class="tb-readonly-badge">👁️ 只读预览</span>
        <span class="quest-name-wrap">
          <input type="text" id="questTitle" value="${esc(STATE.questTitle)}" readonly style="cursor:default;opacity:0.85;">
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
      </div>
      <div class="toolbar-right">
        <button class="tb-btn btn-primary" onclick="saveSharedQddToMine()">💾 保存到我的 QDD</button>
        <button class="tb-btn" id="exportPngBtn">🖼️ 导出PNG</button>
        <button class="tb-btn" id="exportPdfBtn">📄 导出PDF</button>
      </div>
    </header>
    <div id="main">
      <main id="preview-area">
        <div id="preview-scroll-wrap">
          <div id="preview-canvas"></div>
        </div>
      </main>
    </div>
  `;

  // 绑定布局/主题/导出
  const $ls = document.getElementById('layoutSelect');
  if ($ls) { $ls.value = STATE.layout; $ls.addEventListener('change', e => { STATE.layout = e.target.value; savePrefs(); renderPreview(); }); }
  const $ts = document.getElementById('themeSelect');
  if ($ts) { $ts.value = STATE.theme; $ts.addEventListener('change', e => { applyTheme(e.target.value); savePrefs(); }); }
  document.getElementById('exportPngBtn')?.addEventListener('click', exportPng);
  document.getElementById('exportPdfBtn')?.addEventListener('click', exportPdf);

  renderPreview();
}

// 把分享的 QDD 存入自己的数据
function saveSharedQddToMine() {
  if (!STATE.steps || STATE.steps.length === 0) { showToast('❌ 没有数据可保存'); return; }
  // 给每个 step 生成新 id（避免与本地冲突）
  const newQdd = {
    id:    genId(),
    title: STATE.questTitle + '（来自分享）',
    steps: STATE.steps.map(s => ({ ...s, id: genId() })),
  };
  STORE.qdds.push(newQdd);
  saveAllQdds();
  // 清除 hash 并跳转到编辑器
  history.replaceState(null, '', window.location.pathname);
  openQdd(newQdd.id);
  showToast('✅ 已保存到我的 QDD！');
}
