  return `
    <header id="toolbar">
      <div class="toolbar-left">
        <span class="app-title">QDD Flow</span>
      </div>
      <div class="toolbar-center"></div>
      <div class="toolbar-right">
        <label class="tb-btn" title="涓婚">
          <span>涓婚</span>
          <select id="themeSelect">
            <option value="light">鈽€锔?浜壊</option>
            <option value="dark">馃寵 娣辫壊</option>
            <option value="cyber">馃挏 璧涘崥</option>
          </select>
        </label>
        <button class="tb-btn" id="newQddBtn">锛?鏂板缓 QDD</button>
      </div>
    </header>
    <div id="home-page">
      <div class="home-header">
        <h2>鎵€鏈?QDD</h2>
      </div>
      <div id="qdd-card-list"></div>
    </div>
  `;
}

function renderQddCards() {
  const container = document.getElementById('qdd-card-list');
  if (!container) return;
  if (STORE.qdds.length === 0) {
    container.innerHTML = '<p class="home-empty">杩樻病鏈?QDD锛岀偣鍑诲彸涓婅銆岋紜 鏂板缓 QDD銆嶅紑濮?/p>';
    return;
  }
  container.innerHTML = STORE.qdds.map(qdd => `
    <div class="qdd-card" data-id="${qdd.id}">
      <span class="qdd-card-title">${esc(qdd.title)}</span>
      <div class="qdd-card-actions">
        <button class="qdd-card-rename" onclick="renameQdd('${qdd.id}')" title="閲嶅懡鍚?>鉁忥笍</button>
        <button class="qdd-card-delete" onclick="deleteQdd('${qdd.id}')" title="鍒犻櫎">馃棏锔?/button>
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
  const title = prompt('璇疯緭鍏?QDD 鍚嶇О锛?, '鏂板缓 QDD');
  if (!title) return;
  const qdd = { id: genId(), title: title.trim() || '鏂板缓 QDD', steps: [] };
  STORE.qdds.push(qdd);
  saveAllQdds();
  openQdd(qdd.id);
}

function renameQdd(id) {
  const qdd = STORE.qdds.find(q => q.id === id);
  if (!qdd) return;
  const newTitle = prompt('閲嶅懡鍚?QDD锛?, qdd.title);
  if (newTitle === null) return;
  qdd.title = newTitle.trim() || qdd.title;
  saveAllQdds();
  renderQddCards();
}

function deleteQdd(id) {
  if (!confirm('纭鍒犻櫎姝?QDD锛熸鎿嶄綔涓嶅彲鎭㈠銆?)) return;
  STORE.qdds = STORE.qdds.filter(q => q.id !== id);
  saveAllQdds();
  renderQddCards();
  showToast('QDD 宸插垹闄?);
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

function buildEditorPageHTML() {
  return `
    <header id="toolbar">
      <div class="toolbar-left">
        <span class="app-title">QDD Flow</span>
        <button class="tb-btn tb-back-btn" id="backToHomeBtn">鈫?杩斿洖</button>
        <span class="quest-name-wrap">
          <input type="text" id="questTitle" placeholder="浠诲姟鍚嶇О..." value="${esc(STATE.questTitle)}">
        </span>
      </div>
      <div class="toolbar-center">
        <label class="tb-btn" title="甯冨眬鍒囨崲">
          <span>甯冨眬</span>
          <select id="layoutSelect">
            <option value="table">馃搵 琛ㄦ牸寮?/option>
            <option value="timeline">馃幆 鏃堕棿杞村紡</option>
          </select>
        </label>
        <label class="tb-btn" title="涓婚">
          <span>涓婚</span>
          <select id="themeSelect">
