// ===== Persistence =====
const STORAGE_KEYS = {
  layout:          'qdd_layout',
  theme:           'qdd_theme',
  colWidth:        'qdd_colwidth',
  qdds:            'qdd_all_qdds',
  lastQdd:         'qdd_last_id',
  lastView:        'qdd_last_view',
  customTaskTypes: 'qdd_custom_task_types',
  customTriggers:  'qdd_custom_triggers',
};

// ===== 简易分级 Logger =====
const LOG_LEVEL = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const _LOG_CURRENT = LOG_LEVEL.DEBUG; // 发布时改为 INFO

const log = {
  debug: (...a) => _LOG_CURRENT <= LOG_LEVEL.DEBUG && console.debug('[QDD]', ...a),
  info:  (...a) => _LOG_CURRENT <= LOG_LEVEL.INFO  && console.info ('[QDD]', ...a),
  warn:  (...a) => _LOG_CURRENT <= LOG_LEVEL.WARN  && console.warn ('[QDD]', ...a),
  error: (...a) => _LOG_CURRENT <= LOG_LEVEL.ERROR && console.error('[QDD]', ...a),
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
  // sessionStorage = 本次会话完整备份（不受 localStorage 配额裁剪）
  // 优先 sessionStorage，若其中 steps 总量为 0 则降级到 localStorage
  const ssRaw = sessionStorage.getItem(STORAGE_KEYS.qdds);
  const lsRaw = localStorage.getItem(STORAGE_KEYS.qdds);

  const tryParse = (raw, src) => {
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) { log.warn('loadAllQdds: 非数组数据来自', src); return null; }
      return data;
    } catch (e) {
      log.error('loadAllQdds: JSON 解析失败', src, e);
      return null;
    }
  };

  const ssData = tryParse(ssRaw, 'sessionStorage');
  const lsData = tryParse(lsRaw, 'localStorage');

  const countSteps = d => d ? d.reduce((n, q) => n + (q.steps || []).length, 0) : 0;
  const ssSteps = countSteps(ssData);
  const lsSteps = countSteps(lsData);

  log.info(`loadAllQdds: ss=${ssSteps}steps, ls=${lsSteps}steps`);

  // 取 steps 更多的那个来源（通常 ss 是最新的，但如果 ss 为空则用 ls）
  const data = (ssSteps >= lsSteps && ssData) ? ssData : (lsData || ssData);
  if (!data) return null;

  // 清理占位符
  data.forEach(q => {
    (q.steps || []).forEach(s => {
      if (s.imageUrl === '__img__') s.imageUrl = '';
    });
  });

  log.info(`loadAllQdds: 使用数据，${data.length} 个QDD，共 ${countSteps(data)} 个步骤`);
  return data;
}

// 自定义类别的独立读写（体积小，无 quota 问题）
function loadCustomCategories() {
  try {
    const tt = localStorage.getItem(STORAGE_KEYS.customTaskTypes);
    const tr = localStorage.getItem(STORAGE_KEYS.customTriggers);
    if (tt) STORE.customTaskTypes = JSON.parse(tt) || [];
    if (tr) STORE.customTriggers  = JSON.parse(tr) || [];
    log.info('loadCustomCategories: taskTypes=', STORE.customTaskTypes.length,
             'triggers=', STORE.customTriggers.length);
  } catch(e) {
    log.error('loadCustomCategories 失败', e);
  }
}

function saveCustomCategories() {
  try {
    localStorage.setItem(STORAGE_KEYS.customTaskTypes, JSON.stringify(STORE.customTaskTypes));
    localStorage.setItem(STORAGE_KEYS.customTriggers,  JSON.stringify(STORE.customTriggers));
  } catch(e) {
    log.error('saveCustomCategories 失败', e);
  }
}

// ===== Undo / Redo History =====
const HISTORY = {
  stack:     [],
  future:    [],
  MAX:       50,
  _skipNext: false,
};

function pushHistory() {
  if (HISTORY._skipNext) return;
  HISTORY.future = [];
  const snap = JSON.stringify(STORE.qdds);
  if (HISTORY.stack.length > 0 && HISTORY.stack[HISTORY.stack.length - 1] === snap) return;
  HISTORY.stack.push(snap);
  if (HISTORY.stack.length > HISTORY.MAX) HISTORY.stack.shift();
  log.debug(`pushHistory: stack=${HISTORY.stack.length}`);
  updateUndoRedoUI();
}

function undoHistory() {
  if (HISTORY.stack.length === 0) { showToast('没有可撤回的操作'); return; }
  HISTORY.future.push(JSON.stringify(STORE.qdds));
  const snap = HISTORY.stack.pop();
  HISTORY._skipNext = true;
  restoreSnapshot(snap);
  HISTORY._skipNext = false;
  updateUndoRedoUI();
  showToast('✓ 已撤回');
  log.info('undoHistory');
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
  log.info('redoHistory');
}

function restoreSnapshot(snapJson) {
  try {
    STORE.qdds = JSON.parse(snapJson);
    saveAllQdds();
    if (STATE.currentQddId) {
      const qdd = getCurrentQdd();
      if (qdd) {
        syncStateFromQdd(qdd);
        renderAll();
        if (_propPanelStepId) {
          const stillExists = STATE.steps.find(s => s.id === _propPanelStepId);
          if (stillExists) renderStepPanel(); else closeStepPanel();
        }
      }
    }
  } catch(e) {
    log.error('restoreSnapshot 失败', e);
  }
}

function updateUndoRedoUI() {
  const $undo = document.getElementById('undoBtn');
  const $redo = document.getElementById('redoBtn');
  if ($undo) {
    $undo.disabled = HISTORY.stack.length === 0;
    $undo.title = `撤回 (Ctrl+Z)  [${HISTORY.stack.length}步]`;
  }
  if ($redo) {
    $redo.disabled = HISTORY.future.length === 0;
    $redo.title = `重做 (Ctrl+Y)  [${HISTORY.future.length}步]`;
  }
}

let _historyDebounceTimer = null;
function scheduleHistoryPush() {
  clearTimeout(_historyDebounceTimer);
  _historyDebounceTimer = setTimeout(() => pushHistory(), 800);
}

function saveAllQdds() {
  if (!HISTORY._skipNext) scheduleHistoryPush();

  // sessionStorage：实时完整备份（含 idb: key），不占 localStorage 配额
  try {
    sessionStorage.setItem(STORAGE_KEYS.qdds, JSON.stringify(STORE.qdds));
  } catch(e) {
    log.warn('saveAllQdds: sessionStorage 写入失败', e);
  }

  try {
    localStorage.setItem(STORAGE_KEYS.qdds, JSON.stringify(STORE.qdds));
  } catch (e) {
    if (e.name === 'QuotaExceededError') {
      log.warn('saveAllQdds: localStorage 配额超出，尝试降级存储（清空 imageUrl）');
      try {
        const slim = STORE.qdds.map(q => ({
          ...q,
          steps: (q.steps || []).map(s => ({ ...s, imageUrl: '', images: [] })),
        }));
        localStorage.setItem(STORAGE_KEYS.qdds, JSON.stringify(slim));
        log.warn('saveAllQdds: 降级存储成功（图片引用已清空，图片仍在 IndexedDB）');
      } catch (e2) {
        log.error('saveAllQdds: localStorage 完全写入失败', e2);
      }
    } else {
      log.error('saveAllQdds: 写入失败', e);
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
  STATE.steps      = qdd.steps || [];
  STATE.questTitle = qdd.title || '';
}

function syncQddFromState(qdd) {
  qdd.steps = STATE.steps;
  qdd.title = STATE.questTitle;
}

// ===== State =====
const STORE = {
  qdds: [],
  customTaskTypes: [], // [{ value, label, color }]
  customTriggers:  [], // [string]
};

const STATE = {
  steps:        [],
  activeStepId: null,
  layout:       'table',
  theme:        'light',
  colWidth:     200,
  questTitle:   '主线任务 · 示例',
  currentQddId: null,
  editingStepId: null,
  importData:   null,
  importHeaders: [],
  view:         'home',
};

const PRESET_COLORS = [
  '#7c6af7','#4ecdc4','#ff6b6b','#ffd166',
  '#06d6a0','#ef9a9a','#80cbc4','#ce93d8',
  '#ffcc02','#4fc3f7','#ff9800','#a5d6a7',
];

function getStepColor(step, index) {
  if (step.taskType) {
    // 先查内置类型
    if (TASK_TYPE_MAP[step.taskType]) {
      return step.colorOverride || TASK_TYPE_MAP[step.taskType].color;
    }
    // 再查自定义类型
    const custom = STORE.customTaskTypes.find(t => t.value === step.taskType);
    if (custom) return step.colorOverride || custom.color;
  }
  return step.color || PRESET_COLORS[index % PRESET_COLORS.length];
}

function genId() {
  return 'step_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}