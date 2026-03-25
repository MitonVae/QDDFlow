// ===== Toast =====
let toastTimer = null;
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== Helpers =====
function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
/** 同 esc()，但将 \n 也转换为 <br>，用于在 innerHTML / contenteditable 中保留换行 */
function escWithBr(str) {
  return esc(str).replace(/\n/g, '<br>');
}

// ===== Bind Editor Page Events (called after editor HTML is injected) =====
function bindEditorEvents() {
  const $backBtn = document.getElementById('backToHomeBtn');
  if ($backBtn) $backBtn.addEventListener('click', showHomePage);

  const $questTitle = document.getElementById('questTitle');
  if ($questTitle) $questTitle.addEventListener('input', e => {
    STATE.questTitle = e.target.value;
    const qdd = getCurrentQdd(); if (qdd) { syncQddFromState(qdd); saveAllQdds(); }
  });

  const $layoutSelect = document.getElementById('layoutSelect');
  if ($layoutSelect) {
    $layoutSelect.value = STATE.layout;
    $layoutSelect.addEventListener('change', e => {
      STATE.layout = e.target.value;
      savePrefs();
      renderPreview();
    });
  }

  const $themeSelect = document.getElementById('themeSelect');
  if ($themeSelect) {
    $themeSelect.value = STATE.theme;
    $themeSelect.addEventListener('change', e => { applyTheme(e.target.value); savePrefs(); });
  }

  const $colWidthSlider = document.getElementById('colWidthSlider');
  if ($colWidthSlider) {
    $colWidthSlider.value = STATE.colWidth;
    $colWidthSlider.addEventListener('input', e => {
      STATE.colWidth = parseInt(e.target.value, 10);
      const label = document.getElementById('colWidthVal');
      if (label) label.textContent = STATE.colWidth;
      savePrefs();
      if (STATE.layout === 'timeline') renderPreview();
    });
  }

  const $addStepBtn = document.getElementById('addStepBtn');
  if ($addStepBtn) $addStepBtn.addEventListener('click', addStep);

  const $importFile = document.getElementById('importFile');
  if ($importFile) $importFile.addEventListener('change', handleImportFile);

  const $restoreFile = document.getElementById('restoreJsonFile');
  if ($restoreFile) $restoreFile.addEventListener('change', handleRestoreJson);

  const $backupBtn = document.getElementById('backupJsonBtn');
  if ($backupBtn) $backupBtn.addEventListener('click', backupJson);

  const $aiImportBtn = document.getElementById('aiImportBtn');
  if ($aiImportBtn) $aiImportBtn.addEventListener('click', openAiImportPanel);

  const $exportPngBtn = document.getElementById('exportPngBtn');
  if ($exportPngBtn) $exportPngBtn.addEventListener('click', exportPng);

  const $exportPdfBtn = document.getElementById('exportPdfBtn');
  if ($exportPdfBtn) $exportPdfBtn.addEventListener('click', exportPdf);

  const $shareBtn = document.getElementById('shareLinkBtn');
  if ($shareBtn) $shareBtn.addEventListener('click', () => openShareDialog(STATE.currentQddId));

  const $undoBtn = document.getElementById('undoBtn');
  if ($undoBtn) $undoBtn.addEventListener('click', undoHistory);

  const $redoBtn = document.getElementById('redoBtn');
  if ($redoBtn) $redoBtn.addEventListener('click', redoHistory);

  // Apply current layout/theme values to selects
  applyTheme(STATE.theme);
  updateUndoRedoUI();
}

// ===== Init =====
function init() {
  const prefs = loadPrefs();
  STATE.layout   = prefs.layout;
  STATE.theme    = prefs.theme;
  STATE.colWidth = prefs.colWidth;

  const saved = loadAllQdds();
  if (saved && saved.length > 0) {
    STORE.qdds = saved;
  } else {
    const defaultQdd = { id: genId(), title: '主线任务 · 示例', steps: getSampleData() };
    STORE.qdds = [defaultQdd];
    saveAllQdds();
  }

  applyTheme(STATE.theme);
  bindGlobalEvents();

  // 如果是分享链接，直接进入只读预览，不加载本地数据
  if (window.location.hash.startsWith('#share=')) {
    tryLoadSharedQdd();
    return;
  }

  // 迁移旧 base64 图片到 IndexedDB（静默后台执行）
  migrateAllImagesToDb().then(() => {
    // 迁移完成后预热图片缓存，再决定显示哪个页面
    return _preloadStepImages();
  }).then(() => {
    if (prefs.lastView === 'editor' && prefs.lastQdd) {
      const qdd = STORE.qdds.find(q => q.id === prefs.lastQdd);
      if (qdd) { openQdd(qdd.id); return; }
    }
    showHomePage();
  });
}

function getSampleData() {
  return [
    {
      id: genId(), name: '0.任务接取', trigger: 'Room触发', location: '武康大楼·大厅',
      characters: '柚柠, 程醒', desc: '柚柠和程醒到达大楼门口，感觉到有些许异常，任务提示被激活。决定一起调查周边情况。',
      imageUrl: '', color: '#7c6af7', customFields: []
    },
    {
      id: genId(), name: '1.武康大楼', trigger: '接续自动触发', location: '武康大楼一楼',
      characters: '柚柠, 程醒', desc: '两人进入大楼一层，发现走廊灯光异常，地板上有奇怪的痕迹。沿着痕迹向内部深入探查。',
      imageUrl: '', color: '#4ecdc4', customFields: []
    },
    {
      id: genId(), name: '2.对话门卫', trigger: '剧情触发', location: '武康大楼·门卫室',
      characters: '柚柠, 程醒', desc: '门卫神情紧张，透露了关于昨晚异常声音的信息，并建议他们不要深入地下层。',
      imageUrl: '', color: '#ffd166', customFields: []
    },
    {
      id: genId(), name: '3.伪装电工', trigger: '玩家选择', location: '武康大楼·后门',
      characters: '柚柠', desc: '柚柠伪装成电工人员，成功混入内部。程醒在外接应，通过对讲机保持联系。',
      imageUrl: '', color: '#ff6b6b', customFields: [{ key: 'PUZ类型', value: '伪装/潜行' }]
    },
    {
      id: genId(), name: '4.楼道探索', trigger: '接续', location: '武康大楼·内部',
      characters: '柚柠, 程醒', desc: '探索楼层内部，收集线索，发现了一张奇怪的地图和残缺的日记。',
      imageUrl: '', color: '#06d6a0', customFields: [{ key: 'PUZ类型', value: '探索/解密' }]
    },
  ];
}

// ===== Global Events (bound once) =====
function bindGlobalEvents() {
  const $themeSelect = document.getElementById('themeSelect');
  if ($themeSelect) $themeSelect.addEventListener('change', e => { applyTheme(e.target.value); savePrefs(); });

  document.getElementById('step-editor').addEventListener('click', e => {
    if (e.target === document.getElementById('step-editor')) closeStepEditor();
  });
  document.getElementById('import-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('import-modal')) closeImportModal();
  });

  document.addEventListener('keydown', e => {
    const inInput = ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName) ||
      e.target.contentEditable === 'true';
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      if (inInput) return;
      e.preventDefault();
      undoHistory();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      if (inInput) return;
      e.preventDefault();
      redoHistory();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveAllQdds();
      showToast('✓ 已保存');
    }
  });

  setInterval(() => {
    if (STATE.view === 'editor') {
      const qdd = getCurrentQdd();
      if (qdd) { syncQddFromState(qdd); saveAllQdds(); }
      const stamp = new Date().toISOString();
      try {
        localStorage.setItem('qdd_autosave', JSON.stringify({ ts: stamp, qdds: STORE.qdds }));
      } catch(e) {}
      updateAutoSaveLabel(stamp);
    }
  }, 30000);
}

function updateAutoSaveLabel(isoTs) {
  const el = document.getElementById('autosave-label');
  if (!el) return;
  if (isoTs) {
    const d = new Date(isoTs);
    el.textContent = `自动保存 ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  } else {
    el.textContent = '';
  }
}

const THEME_ICONS = { light: '☀️', dark: '🌙', cyber: '💜' };

function applyTheme(theme) {
  STATE.theme = theme;
  document.body.className = `theme-${theme}`;
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = THEME_ICONS[theme] || '🎨';
  const sel = document.getElementById('themeSelect');
  if (sel) sel.value = theme;
}

// ===== Start =====
init();