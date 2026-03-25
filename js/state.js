// ===== Persistence =====
const STORAGE_KEYS = {
  layout:   'qdd_layout',
  theme:    'qdd_theme',
  colWidth: 'qdd_colwidth',
  qdds:     'qdd_all_qdds',
  lastQdd:  'qdd_last_id',
  lastView: 'qdd_last_view', // 'home' | 'editor'
};
function loadPrefs() {
  return {
    layout:   localStorage.getItem(STORAGE_KEYS.layout)   || 'table',
    theme:    localStorage.getItem(STORAGE_KEYS.theme)    || 'light',
    colWidth: parseInt(localStorage.getItem(STORAGE_KEYS.colWidth) || '200', 10),
    lastQdd:  localStorage.getItem(STORAGE_KEYS.lastQdd)  || null,
    lastView: localStorage.getItem(STORAGE_KEYS.lastView) || 'home',
  };
}
function savePrefs() {
  localStorage.setItem(STORAGE_KEYS.layout,   STATE.layout);
  localStorage.setItem(STORAGE_KEYS.theme,    STATE.theme);
  localStorage.setItem(STORAGE_KEYS.colWidth, STATE.colWidth);
  localStorage.setItem(STORAGE_KEYS.lastView, STATE.view);
  if (STATE.currentQddId) {
    localStorage.setItem(STORAGE_KEYS.lastQdd, STATE.currentQddId);
  }
}

// ===== Multi-QDD Store =====
function loadAllQdds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.qdds);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // 清理旧版占位符和 idb: 引用（这些在当前版本无法显示）
    data.forEach(q => {
      (q.steps || []).forEach(s => {
        if (!s.imageUrl || s.imageUrl === '__img__' || s.imageUrl.startsWith('idb:')) {
          s.imageUrl = '';
        }
        s.images = [];
      });
    });
    return data;
  } catch(e) {}
  return null;
}
// ===== Undo / Redo History =====
const HISTORY = {
  stack: [],   // past snapshots (array of JSON strings)
  future: [],  // redo stack
  MAX: 50,
  _skipNext: false, // flag to avoid recording during undo/redo itself
};

/** Call BEFORE any mutation to STATE.steps or STORE.qdds */
function pushHistory() {
  if (HISTORY._skipNext) return;
  HISTORY.future = []; // clear redo on new action
  const snap = JSON.stringify(STORE.qdds);
  // Avoid pushing identical snapshots
  if (HISTORY.stack.length > 0 && HISTORY.stack[HISTORY.stack.length - 1] === snap) return;
  HISTORY.stack.push(snap);
  if (HISTORY.stack.length > HISTORY.MAX) HISTORY.stack.shift();
  updateUndoRedoUI();
}

function undoHistory() {
  if (HISTORY.stack.length === 0) { showToast('没有可撤回的操作'); return; }
  // Save current state to redo stack
  HISTORY.future.push(JSON.stringify(STORE.qdds));
  const snap = HISTORY.stack.pop();
  HISTORY._skipNext = true;
  restoreSnapshot(snap);
  HISTORY._skipNext = false;
  updateUndoRedoUI();
  showToast('✓ 已撤回');
}

function redoHistory() {
  if (HISTORY.future.length === 0) { showToast('没有可重做的操作'); return; }
  HISTORY.stack.push(JSON.stringify(STORE.qdds));
  const snap = HISTORY.future.pop();
  HISTORY._skipNext = true;
  restoreSnapshot(snap);
  HISTORY._skipNext = false;
  updateUndoRedoUI();
  showToast('✓ 已重做');
}

function restoreSnapshot(snapJson) {
  try {
    STORE.qdds = JSON.parse(snapJson);
    saveAllQdds();
    // Re-sync STATE if we're in editor
    if (STATE.currentQddId) {
      const qdd = getCurrentQdd();
      if (qdd) {
        syncStateFromQdd(qdd);
        renderAll();
        // Re-open prop panel if a step was being edited
        if (_propPanelStepId) {
          const stillExists = STATE.steps.find(s => s.id === _propPanelStepId);
          if (stillExists) renderStepPanel();
          else closeStepPanel();
        }
      }
    }
  } catch(e) { console.error('Undo restore failed', e); }
}

function updateUndoRedoUI() {
  const $undo = document.getElementById('undoBtn');
  const $redo = document.getElementById('redoBtn');
  if ($undo) $undo.disabled = HISTORY.stack.length === 0;
  if ($redo) $redo.disabled = HISTORY.future.length === 0;
  if ($undo) $undo.title = `撤回 (Ctrl+Z)  [${HISTORY.stack.length}步]`;
  if ($redo) $redo.title = `重做 (Ctrl+Y)  [${HISTORY.future.length}步]`;
}

// Debounced history push: groups rapid consecutive edits into one undo step
let _historyDebounceTimer = null;
function scheduleHistoryPush() {
  clearTimeout(_historyDebounceTimer);
  _historyDebounceTimer = setTimeout(() => pushHistory(), 800);
}

function saveAllQdds() {
  if (!HISTORY._skipNext) scheduleHistoryPush();
  try {
    localStorage.setItem(STORAGE_KEYS.qdds, JSON.stringify(STORE.qdds));
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      // 图片 base64 太大，存一份不含图片的版本保留其他数据
      try {
        const slim = STORE.qdds.map(q => ({
          ...q,
          steps: q.steps.map(s => ({ ...s, imageUrl: '', images: [] }))
        }));
        localStorage.setItem(STORAGE_KEYS.qdds, JSON.stringify(slim));
        showToast('⚠️ 图片过大无法保存，其他数据已保留');
      } catch (e2) {
        console.error('[saveAllQdds] localStorage 完全写入失败', e2);
      }
    } else {
      console.error('[saveAllQdds] 写入失败', e);
    }
  }
  if (STATE.currentQddId) {
    try { localStorage.setItem(STORAGE_KEYS.lastQdd, STATE.currentQddId); } catch(e) {}
  }
  updateAutoSaveLabel();
}
function getCurrentQdd() {
  return STORE.qdds.find(q => q.id === STATE.currentQddId) || null;
}
function syncStateFromQdd(qdd) {
  STATE.steps      = qdd.steps;
  STATE.questTitle = qdd.title;
}
function syncQddFromState(qdd) {
  qdd.steps = STATE.steps;
  qdd.title = STATE.questTitle;
}

// ===== State =====
const STORE = { qdds: [] }; // all QDDs

const STATE = {
  steps: [],
  activeStepId: null,
  layout: 'table', // 'table' | 'timeline'
  theme: 'light',
  colWidth: 200, // timeline column width in px
  questTitle: '主线任务 · 示例',
  currentQddId: null, // null = on home page
  editingStepId: null,
  importData: null,
  importHeaders: [],
  view: 'home', // 'home' | 'editor'
};

const PRESET_COLORS = [
  '#7c6af7','#4ecdc4','#ff6b6b','#ffd166',
  '#06d6a0','#ef9a9a','#80cbc4','#ce93d8',
  '#ffcc02','#4fc3f7','#ff9800','#a5d6a7',
];

function getStepColor(step, index) {
  // If step has a taskType and no manual color override, use taskType color
  if (step.taskType && TASK_TYPE_MAP[step.taskType]) {
    return step.colorOverride || TASK_TYPE_MAP[step.taskType].color;
  }
  return step.color || PRESET_COLORS[index % PRESET_COLORS.length];
}

function genId() {
  return 'step_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}
