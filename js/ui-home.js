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
    <header id="toolbar">
      <div class="toolbar-left">
        <span class="app-title">QDD Flow</span>
      </div>
      <div class="toolbar-center"></div>
      <div class="toolbar-right">
        <label class="tb-btn" title="主题">
          <span>主题</span>
          <select id="themeSelect">
            <option value="light">☀️ 亮色</option>
            <option value="dark">🌙 深色</option>
            <option value="cyber">💜 赛博</option>
          </select>
        </label>
        <button class="tb-btn" id="newQddBtn">＋ 新建 QDD</button>
      </div>
    </header>
    <div id="home-page">
      <div class="home-header">
        <h2>所有 QDD</h2>
      </div>
      <div id="qdd-card-list"></div>
    </div>
  `;
}

function renderQddCards() {
  const container = document.getElementById('qdd-card-list');
  if (!container) return;
  if (STORE.qdds.length === 0) {
    container.innerHTML = '<p class="home-empty">还没有 QDD，点击右上角「＋ 新建 QDD」开始</p>';
    return;
  }
  container.innerHTML = STORE.qdds.map(qdd => `
    <div class="qdd-card" data-id="${qdd.id}">
      <span class="qdd-card-title">${esc(qdd.title)}</span>
      <div class="qdd-card-actions">
        <button class="qdd-card-share" onclick="openShareDialog('${qdd.id}');event.stopPropagation()" title="生成分享链接">🔗</button>
        <button class="qdd-card-rename" onclick="renameQdd('${qdd.id}')" title="重命名">✏️</button>
        <button class="qdd-card-delete" onclick="deleteQdd('${qdd.id}')" title="删除">🗑️</button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.qdd-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.qdd-card-actions')) return;
      openQdd(card.dataset.id);
    });
  });
}

function createNewQdd() {
  const title = prompt('请输入 QDD 名称：', '新建 QDD');
  if (!title) return;
  const qdd = { id: genId(), title: title.trim() || '新建 QDD', steps: [] };
  STORE.qdds.push(qdd);
  saveAllQdds();
  openQdd(qdd.id);
}

function renameQdd(id) {
  const qdd = STORE.qdds.find(q => q.id === id);
  if (!qdd) return;
  const newTitle = prompt('重命名 QDD：', qdd.title);
  if (newTitle === null) return;
  qdd.title = newTitle.trim() || qdd.title;
  saveAllQdds();
  renderQddCards();
}

function deleteQdd(id) {
  if (!confirm('确认删除此 QDD？此操作不可恢复。')) return;
  STORE.qdds = STORE.qdds.filter(q => q.id !== id);
  saveAllQdds();
  renderQddCards();
  showToast('QDD 已删除');
}

function openQdd(id) {
  const qdd = STORE.qdds.find(q => q.id === id);
  if (!qdd) return;
  STATE.currentQddId = id;
  STATE.view = 'editor';
  syncStateFromQdd(qdd);
  savePrefs(); // persist view=editor + currentQddId so refresh reopens this QDD

  document.getElementById('app').innerHTML = buildEditorPageHTML();
  // modals are already in DOM (from index.html), just reset them
  const se = document.getElementById('step-editor');
  const im = document.getElementById('import-modal');
  if (se) se.classList.add('hidden');
  if (im) im.classList.add('hidden');

  bindEditorEvents();
  renderAll();
}
