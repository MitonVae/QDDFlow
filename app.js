// ===== Task Type Config =====
const TASK_TYPES = [
  { value: '',      label: '—（未设定）', color: null },
  { value: 'PUZ',   label: 'PUZ 玩法',   color: '#7c6af7' }, // 紫
  { value: 'BAT',   label: 'BAT 战斗',   color: '#06d6a0' }, // 绿
  { value: 'NAV',   label: 'NAV 跑图',   color: '#ffd166' }, // 黄
  { value: 'STORY', label: '剧情',        color: '#8e9aaf' }, // 灰
];
const TASK_TYPE_MAP = Object.fromEntries(TASK_TYPES.filter(t => t.value).map(t => [t.value, t]));

const TRIGGER_OPTIONS = [
  'Room触发',
  '接续自动触发',
  '剧情触发',
  '玩家选择',
  '接续',
];

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
    if (raw) return JSON.parse(raw);
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
  localStorage.setItem(STORAGE_KEYS.qdds, JSON.stringify(STORE.qdds));
  if (STATE.currentQddId) {
    localStorage.setItem(STORAGE_KEYS.lastQdd, STATE.currentQddId);
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

// ===== DOM Refs =====
const $stepsList = document.getElementById('steps-list');
const $previewCanvas = document.getElementById('preview-canvas');
const $stepCount = document.getElementById('step-count');
const $addStepBtn = document.getElementById('addStepBtn');
const $layoutSelect = document.getElementById('layoutSelect');
const $themeSelect = document.getElementById('themeSelect');
const $questTitleInput = document.getElementById('questTitle');
const $importFileInput = document.getElementById('importFile');
const $exportPngBtn = document.getElementById('exportPngBtn');
const $exportPdfBtn = document.getElementById('exportPdfBtn');

// ===== Init =====
function init() {
  // Restore saved preferences (layout, theme, colWidth, lastView, lastQdd)
  const prefs = loadPrefs();
  STATE.layout   = prefs.layout;
  STATE.theme    = prefs.theme;
  STATE.colWidth = prefs.colWidth;

  // Load all QDDs from localStorage
  const saved = loadAllQdds();
  if (saved && saved.length > 0) {
    STORE.qdds = saved;
  } else {
    // First launch: create default QDD with sample data
    const defaultQdd = { id: genId(), title: '主线任务 · 示例', steps: getSampleData() };
    STORE.qdds = [defaultQdd];
    saveAllQdds();
  }

  applyTheme(STATE.theme);
  bindGlobalEvents();

  // Restore last view: if user was in editor, reopen that QDD directly
  if (prefs.lastView === 'editor' && prefs.lastQdd) {
    const qdd = STORE.qdds.find(q => q.id === prefs.lastQdd);
    if (qdd) {
      openQdd(qdd.id);
      return;
    }
  }
  showHomePage();
  _initImageZoneDelegation(); // register once, survives all re-renders
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
  // Theme select (always in DOM)
  const $themeSelect = document.getElementById('themeSelect');
  if ($themeSelect) $themeSelect.addEventListener('change', e => { applyTheme(e.target.value); savePrefs(); });

  // Close modals on backdrop click
  document.getElementById('step-editor').addEventListener('click', e => {
    if (e.target === document.getElementById('step-editor')) closeStepEditor();
  });
  document.getElementById('import-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('import-modal')) closeImportModal();
  });

  // Keyboard shortcuts: Undo / Redo
  document.addEventListener('keydown', e => {
    const inInput = ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName) ||
      e.target.contentEditable === 'true';
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      if (inInput) return; // let browser handle native undo in inputs
      e.preventDefault();
      undoHistory();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      if (inInput) return;
      e.preventDefault();
      redoHistory();
    }
    // Ctrl+S: manual save toast
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveAllQdds();
      showToast('✓ 已保存');
    }
  });

  // Auto-save every 30 seconds
  setInterval(() => {
    if (STATE.view === 'editor') {
      const qdd = getCurrentQdd();
      if (qdd) { syncQddFromState(qdd); saveAllQdds(); }
      // Also write autosave backup slot
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

// ===== Editor page events (re-bound each time editor page is shown) =====
function bindEditorEvents() {
  const $addStepBtn    = document.getElementById('addStepBtn');
  const $layoutSelect  = document.getElementById('layoutSelect');
  const $questTitleInput = document.getElementById('questTitle');
  const $importFileInput = document.getElementById('importFile');
  const $exportPngBtn  = document.getElementById('exportPngBtn');
  const $exportPdfBtn  = document.getElementById('exportPdfBtn');
  const $backBtn       = document.getElementById('backToHomeBtn');
  const $slider        = document.getElementById('colWidthSlider');
  const $label         = document.getElementById('colWidthVal');

  if ($addStepBtn)    $addStepBtn.addEventListener('click', () => openStepEditor(null));
  if ($layoutSelect)  {
    $layoutSelect.value = STATE.layout;
    $layoutSelect.addEventListener('change', e => { STATE.layout = e.target.value; savePrefs(); renderPreview(); });
  }
  if ($questTitleInput) {
    $questTitleInput.value = STATE.questTitle;
    $questTitleInput.addEventListener('input', e => {
      STATE.questTitle = e.target.value;
      const qdd = getCurrentQdd();
      if (qdd) { qdd.title = e.target.value; saveAllQdds(); }
      renderPreview();
    });
  }
  if ($importFileInput) $importFileInput.addEventListener('change', handleImportFile);
  if ($exportPngBtn)    $exportPngBtn.addEventListener('click', exportPng);
  if ($exportPdfBtn)    $exportPdfBtn.addEventListener('click', exportPdf);
  if ($backBtn) $backBtn.addEventListener('click', showHomePage);
  if ($slider) {
    $slider.value = STATE.colWidth;
    if ($label) $label.textContent = STATE.colWidth;
    $slider.addEventListener('input', e => {
      STATE.colWidth = parseInt(e.target.value, 10);
      if ($label) $label.textContent = STATE.colWidth;
      savePrefs();
      renderPreview();
    });
  }
  // Sync theme select
  const $ts = document.getElementById('themeSelect');
  if ($ts) $ts.value = STATE.theme;

  // Undo / Redo buttons
  const $undoBtn = document.getElementById('undoBtn');
  const $redoBtn = document.getElementById('redoBtn');
  if ($undoBtn) $undoBtn.addEventListener('click', undoHistory);
  if ($redoBtn) $redoBtn.addEventListener('click', redoHistory);
  updateUndoRedoUI();

  // Backup JSON
  const $backupBtn = document.getElementById('backupJsonBtn');
  if ($backupBtn) $backupBtn.addEventListener('click', exportBackupJson);

  // Restore JSON
  const $restoreInput = document.getElementById('restoreJsonFile');
  if ($restoreInput) $restoreInput.addEventListener('change', handleRestoreJson);

  // AI Import Panel
  const $aiImportBtn = document.getElementById('aiImportBtn');
  if ($aiImportBtn) $aiImportBtn.addEventListener('click', openAiImportPanel);
}

const THEME_ICONS = { light: '☀️', dark: '🌙', cyber: '💜' };

function applyTheme(theme) {
  STATE.theme = theme;
  document.body.className = `theme-${theme}`;
  // Update theme icon in toolbar if present
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = THEME_ICONS[theme] || '🎨';
  // Keep select in sync
  const sel = document.getElementById('themeSelect');
  if (sel) sel.value = theme;
}

// ===== AI Import Panel =====
const AI_PROMPT_TEMPLATE = `你是一个游戏策划助理，我需要你帮我把剧情大纲整理成 QDD Flow 工具可以直接导入的 JSON 格式。

【输出格式规范】

输出一个合法的 JSON 对象（单个 QDD），结构如下：

{
  "title": "QDD名称（任务线名称）",
  "steps": [
    {
      "name": "0.环节名称",
      "taskType": "STORY",
      "trigger": "Room触发",
      "location": "场景名称",
      "characters": "NPC名称，用逗号分隔",
      "desc": "这个环节的详细描述，包括玩家要做什么、剧情内容摘要等。",
      "images": [],
      "customFields": [
        { "key": "自定义字段名", "value": "字段内容" }
      ]
    }
  ]
}

【字段说明】

▌ title（必填）：整条任务线的名称，如"第一章·武康大楼"

▌ steps（必填）：环节数组，每个环节包含以下字段：

  • name（必填）：环节编号+名称，建议格式 "0.环节名"，如 "0.任务接取"
  
  • taskType（必填）：任务类型，只能是以下四个值之一：
      - "PUZ"   玩法环节（解谜、潜行、互动等）
      - "BAT"   战斗环节
      - "NAV"   跑图/导航环节（纯移动、探索地图）
      - "STORY" 剧情环节（对话、过场动画、timeline）
      - ""      （空字符串）表示未分类
      
  • trigger（可选）：触发方式，建议从以下选项选取（也可自定义）：
      "Room触发" / "接续自动触发" / "剧情触发" / "玩家选择" / "接续"
      
  • location（可选）：发生地点/场景名称，如 "武康大楼·大厅"
  
  • characters（可选）：涉及的角色/NPC，多个用逗号分隔，如 "门卫张三, 主角"
  
  • desc（可选但重要）：环节描述，说明玩家行为、剧情内容、设计意图等，可多行
  
  • images（可选）：留空数组 [] 即可，图片通过工具手动上传
  
  • customFields（可选）：自定义参数数组，每项格式 {"key":"字段名","value":"内容"}
      常用示例：
      - PUZ类型的玩法：{"key":"玩法类型","value":"解谜/潜行"}
      - BAT类型的怪物：{"key":"敌人","value":"普通士兵×3"}
      - 奖励内容：{"key":"奖励","value":"道具·钥匙"}
      - 分支选项：{"key":"分支","value":"A.选择合作 / B.选择对抗"}

【注意事项】

1. 只输出 JSON，不要有任何额外的解释文字（可以在 JSON 前后用代码块包裹）
2. 所有字符串值不能包含未转义的引号
3. desc 字段中的换行用 \\n 表示
4. 不需要填写 id、color、imageUrl、colorOverride 等字段，工具会自动生成
5. 按流程顺序排列 steps，编号从 0 开始

【示例输出】

\`\`\`json
{
  "title": "第一章·武康大楼",
  "steps": [
    {
      "name": "0.任务接取",
      "taskType": "STORY",
      "trigger": "Room触发",
      "location": "武康大楼·大厅",
      "characters": "神秘人",
      "desc": "玩家进入武康大楼大厅，触发过场动画。神秘人出现并委托玩家寻找失踪的档案。",
      "images": [],
      "customFields": []
    },
    {
      "name": "1.大厅探索",
      "taskType": "NAV",
      "trigger": "接续自动触发",
      "location": "武康大楼·一楼",
      "characters": "",
      "desc": "玩家在大厅自由探索，可与门卫对话获取线索，发现后门入口。",
      "images": [],
      "customFields": [
        { "key": "可交互物件", "value": "公告栏、电话亭、前台电脑" }
      ]
    },
    {
      "name": "2.伪装电工",
      "taskType": "PUZ",
      "trigger": "玩家选择",
      "location": "武康大楼·后门",
      "characters": "门卫李四",
      "desc": "玩家需要找到电工服并伪装成维修人员，通过门卫的检查进入内部。\\n失败惩罚：重新开始潜行。",
      "images": [],
      "customFields": [
        { "key": "玩法类型", "value": "伪装/潜行" },
        { "key": "通关条件", "value": "成功骗过门卫" }
      ]
    }
  ]
}
\`\`\`

---
现在请根据我提供的内容，按上述格式输出 QDD JSON：

[在这里粘贴你的剧情大纲、任务设计文档等内容]`;

function openAiImportPanel() {
  let overlay = document.getElementById('ai-import-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'ai-import-overlay';
    overlay.className = 'ai-import-overlay';
    overlay.innerHTML = `
      <div class="ai-import-panel">
        <div class="ai-import-header">
          <div class="ai-import-title">
            <span>🤖 AI 导入助手</span>
            <small>复制提示词 → 发给AI → 粘贴JSON → 导入</small>
          </div>
          <button class="ai-import-close" onclick="closeAiImportPanel()">×</button>
        </div>
        <div class="ai-import-body">
          <div class="ai-import-col">
            <div class="ai-col-header">
              <span>① 复制提示词，发给 AI</span>
              <button class="ai-copy-btn" onclick="copyAiPrompt()">📋 复制全部</button>
            </div>
            <pre class="ai-prompt-pre" id="ai-prompt-content">${escHtml(AI_PROMPT_TEMPLATE)}</pre>
          </div>
          <div class="ai-import-col">
            <div class="ai-col-header">
              <span>② 粘贴 AI 输出的 JSON，点击导入</span>
              <div class="ai-import-mode-row">
                <label><input type="radio" name="ai-import-mode" value="add" checked> 追加到当前 QDD</label>
                <label><input type="radio" name="ai-import-mode" value="patch"> 修改指定环节</label>
                <label><input type="radio" name="ai-import-mode" value="new"> 创建为新 QDD</label>
              </div>
              <div class="ai-import-mode-hint" id="ai-import-mode-hint"></div>
            </div>
            <textarea class="ai-json-input" id="ai-json-input" placeholder='粘贴 AI 输出的 JSON 到这里...\n\n支持格式：\n• 单个 QDD 对象：{ "title": "...", "steps": [...] }\n• 多个 QDD 数组：[{ "title": "...", "steps": [...] }, ...]'></textarea>
            <div class="ai-import-actions">
              <button class="ai-validate-btn" onclick="validateAiJson()">🔍 验证格式</button>
              <button class="ai-do-import-btn" onclick="doAiImport()">⬇️ 导入</button>
            </div>
            <div class="ai-import-feedback" id="ai-import-feedback"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeAiImportPanel(); });
  }
  overlay.classList.add('visible');

  // Bind mode radio hint
  overlay.querySelectorAll('input[name="ai-import-mode"]').forEach(radio => {
    radio.addEventListener('change', updateAiModeHint);
  });
  updateAiModeHint();
}

function updateAiModeHint() {
  const hint = document.getElementById('ai-import-mode-hint');
  if (!hint) return;
  const mode = document.querySelector('input[name="ai-import-mode"]:checked')?.value;
  const msgs = {
    add:   '',
    patch: '💡 按环节编号（index）或名称匹配，只更新 JSON 里有值的字段，原有图片/空字段保留不变；找不到匹配则追加为新环节。JSON 中每个环节需包含 "index" 或 "name" 字段用于定位。',
    new:   '',
  };
  hint.textContent = msgs[mode] || '';
  hint.style.display = msgs[mode] ? 'block' : 'none';
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function closeAiImportPanel() {
  const overlay = document.getElementById('ai-import-overlay');
  if (overlay) overlay.classList.remove('visible');
}

function copyAiPrompt() {
  navigator.clipboard.writeText(AI_PROMPT_TEMPLATE).then(() => {
    const btn = document.querySelector('.ai-copy-btn');
    if (btn) { btn.textContent = '✓ 已复制！'; setTimeout(() => { btn.textContent = '📋 复制全部'; }, 2000); }
  }).catch(() => {
    const el = document.createElement('textarea');
    el.value = AI_PROMPT_TEMPLATE;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('提示词已复制');
  });
}

function parseAiJsonInput() {
  const raw = document.getElementById('ai-json-input')?.value?.trim() || '';
  if (!raw) return { error: '请先粘贴 AI 输出的 JSON' };
  let cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  let parsed;
  try { parsed = JSON.parse(cleaned); }
  catch (e) { return { error: `JSON 解析失败：${e.message}` }; }
  let qdds = [];
  if (Array.isArray(parsed)) {
    qdds = parsed;
  } else if (parsed && typeof parsed === 'object') {
    if (parsed.qdds && Array.isArray(parsed.qdds)) {
      qdds = parsed.qdds;
    } else if (parsed.steps || parsed.title) {
      qdds = [parsed];
    } else {
      return { error: '格式不识别：需要包含 "title" 和 "steps" 字段' };
    }
  } else {
    return { error: '格式不识别：需要 JSON 对象或数组' };
  }
  for (const q of qdds) {
    if (!Array.isArray(q.steps)) return { error: `QDD "${q.title||'未命名'}" 缺少 steps 数组` };
  }
  return { qdds };
}

function setAiFeedback(msg, isError) {
  const el = document.getElementById('ai-import-feedback');
  if (!el) return;
  el.textContent = msg;
  el.className = 'ai-import-feedback ' + (isError ? 'ai-feedback-error' : 'ai-feedback-ok');
}

function validateAiJson() {
  const result = parseAiJsonInput();
  if (result.error) {
    setAiFeedback('❌ ' + result.error, true);
  } else {
    const totalSteps = result.qdds.reduce((s, q) => s + (q.steps?.length || 0), 0);
    setAiFeedback(`✅ 格式正确：${result.qdds.length} 个 QDD，共 ${totalSteps} 个环节，可以导入`, false);
  }
}

function doAiImport() {
  const result = parseAiJsonInput();
  if (result.error) { setAiFeedback('❌ ' + result.error, true); return; }
  const mode = document.querySelector('input[name="ai-import-mode"]:checked')?.value || 'new';
  const { qdds } = result;
  pushHistory();

  if (mode === 'patch') {
    // ── 修改指定环节模式 ──
    const currentQdd = getCurrentQdd();
    if (!currentQdd) { setAiFeedback('❌ 当前没有打开的 QDD，请先选择或创建一个', true); return; }
    const srcSteps = (qdds[0].steps || []);
    let matched = 0, added = 0;
    srcSteps.forEach(incoming => {
      // Match by index field first, then by name
      let target = null;
      const idxStr = incoming.index != null ? String(incoming.index).trim() : '';
      if (idxStr) {
        target = currentQdd.steps.find(s => String(s.index || '').trim() === idxStr);
      }
      if (!target && incoming.name) {
        target = currentQdd.steps.find(s => s.name === incoming.name);
      }
      if (target) {
        mergeAiStep(target, incoming);
        matched++;
      } else {
        // No match → append as new step
        currentQdd.steps.push(normalizeAiStep(incoming));
        added++;
      }
    });
    syncStateFromQdd(currentQdd);
    saveAllQdds();
    renderAll();
    const msg = `✅ 已更新 ${matched} 个环节${added > 0 ? `，追加 ${added} 个新环节` : ''}`;
    setAiFeedback(msg, false);
    showToast(msg);

  } else if (mode === 'add') {
    const currentQdd = getCurrentQdd();
    if (!currentQdd) { setAiFeedback('❌ 当前没有打开的 QDD，请先选择或创建一个', true); return; }
    const srcQdd = qdds[0];
    const newSteps = (srcQdd.steps || []).map(s => normalizeAiStep(s));
    currentQdd.steps.push(...newSteps);
    syncStateFromQdd(currentQdd);
    saveAllQdds();
    renderAll();
    setAiFeedback(`✅ 已追加 ${newSteps.length} 个环节到当前 QDD`, false);
    showToast(`已追加 ${newSteps.length} 个环节`);

  } else {
    for (const raw of qdds) {
      const newQdd = {
        id: genId(),
        title: raw.title || '从AI导入',
        steps: (raw.steps || []).map(s => normalizeAiStep(s)),
      };
      STORE.qdds.push(newQdd);
    }
    saveAllQdds();
    setAiFeedback(`✅ 已创建 ${qdds.length} 个新 QDD`, false);
    showToast(`已导入 ${qdds.length} 个 QDD`);
    closeAiImportPanel();
    showHomePage();
  }
}

function normalizeAiStep(raw) {
  return {
    id:            genId(),
    index:         raw.index != null ? String(raw.index) : '',
    name:          raw.name         || '未命名环节',
    taskType:      raw.taskType     || '',
    trigger:       raw.trigger      || '',
    location:      raw.location     || '',
    characters:    raw.characters   || '',
    desc:          raw.desc         || '',
    images:        Array.isArray(raw.images) ? raw.images : [],
    imageUrl:      raw.imageUrl     || '',
    color:         raw.color        || '',
    colorOverride: raw.colorOverride|| '',
    customFields:  Array.isArray(raw.customFields)
      ? raw.customFields.map(f => ({ key: f.key || '', value: f.value || '' }))
      : [],
  };
}

/**
 * Merge incoming AI step data into an existing step.
 * Only fields that are non-empty in `incoming` will overwrite the existing value.
 * Fields not present or empty in incoming are left untouched (preserves images, etc.)
 */
function mergeAiStep(existing, incoming) {
  const str = v => (v != null ? String(v).trim() : '');
  if (str(incoming.index))      existing.index      = str(incoming.index);
  if (str(incoming.name))       existing.name       = str(incoming.name);
  if (str(incoming.taskType))   existing.taskType   = str(incoming.taskType);
  if (str(incoming.trigger))    existing.trigger    = str(incoming.trigger);
  if (str(incoming.location))   existing.location   = str(incoming.location);
  if (str(incoming.characters)) existing.characters = str(incoming.characters);
  if (str(incoming.desc))       existing.desc       = str(incoming.desc);
  if (str(incoming.color))      existing.color      = str(incoming.color);
  if (str(incoming.colorOverride)) existing.colorOverride = str(incoming.colorOverride);
  // Images: only overwrite if incoming has non-empty images array
  if (Array.isArray(incoming.images) && incoming.images.length > 0) {
    existing.images = incoming.images;
  }
  if (str(incoming.imageUrl) && (!existing.images || existing.images.length === 0)) {
    existing.imageUrl = str(incoming.imageUrl);
  }
  // customFields: merge per key — add new keys, update existing keys if value non-empty
  if (Array.isArray(incoming.customFields)) {
    if (!Array.isArray(existing.customFields)) existing.customFields = [];
    incoming.customFields.forEach(f => {
      if (!f.key) return;
      const found = existing.customFields.find(e => e.key === f.key);
      if (found) {
        if (str(f.value)) found.value = str(f.value);
      } else {
        existing.customFields.push({ key: f.key, value: str(f.value) });
      }
    });
  }
}

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

function buildEditorPageHTML() {
  return `
    <header id="toolbar">
      <div class="toolbar-left">
        <span class="app-title">QDD Flow</span>
        <button class="tb-btn tb-back-btn" id="backToHomeBtn">← 返回</button>
        <span class="quest-name-wrap">
          <input type="text" id="questTitle" placeholder="任务名称..." value="${esc(STATE.questTitle)}">
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
        <label class="tb-btn tb-slider-btn" title="调整列宽">
          <span>列宽 <span id="colWidthVal">${STATE.colWidth}</span>px</span>
          <input type="range" id="colWidthSlider" min="120" max="380" step="10" value="${STATE.colWidth}">
        </label>
      </div>
      <div class="toolbar-right">
        <button class="tb-btn tb-undo-btn" id="undoBtn" disabled title="撤回 (Ctrl+Z)">↩ 撤回</button>
        <button class="tb-btn tb-undo-btn" id="redoBtn" disabled title="重做 (Ctrl+Y)">↪ 重做</button>
        <span class="tb-divider"></span>
        <label class="tb-btn icon-btn" title="导入Excel/CSV">
          📂 导入
          <input type="file" id="importFile" accept=".xlsx,.xls,.csv" style="display:none">
        </label>
        <label class="tb-btn icon-btn" title="从JSON备份文件恢复">
          📥 恢复
          <input type="file" id="restoreJsonFile" accept=".json" style="display:none">
        </label>
        <button class="tb-btn" id="backupJsonBtn" title="导出全部数据为JSON备份文件">💾 备份</button>
        <button class="tb-btn tb-btn-ai" id="aiImportBtn" title="用AI生成QDD结构并导入">🤖 AI 导入</button>
        <button class="tb-btn" id="addStepBtn">➕ 添加环节</button>
        <span id="autosave-label" class="tb-autosave-label"></span>
        <button class="tb-btn" id="exportPngBtn">🖼️ 导出PNG</button>
        <button class="tb-btn" id="exportPdfBtn">📄 导出PDF</button>
      </div>
    </header>
    <div id="main">
      <aside id="editor-panel">
        <div id="editor-panel-header">
          <span>环节列表</span>
          <small id="step-count">0 个环节</small>
          <button class="sl-batch-toggle" id="slBatchToggle" onclick="toggleBatchMode()">批量操作</button>
        </div>
        <div id="steps-list"></div>
        <div id="steps-list-footer">
          <div class="batch-action-bar hidden" id="slBatchBar">
            <button class="sl-select-all-btn" onclick="selectAllSteps()">全选</button>
            <button class="sl-batch-del-btn" onclick="batchDeleteSteps()">🗑 删除所选</button>
            <button class="sl-batch-cancel-btn" onclick="toggleBatchMode()">取消</button>
          </div>
          <div class="sl-add-row">
            <button class="sl-add-btn" onclick="addStep()">＋ 添加环节</button>
            <input type="number" id="addCountInput" min="1" max="20" value="1" title="一次添加多个" style="width:48px">
            <button class="sl-add-btn" onclick="addMultipleSteps()" title="批量添加">批量</button>
          </div>
        </div>
      </aside>
      <main id="preview-area">
        <div id="preview-scroll-wrap">
          <div id="preview-canvas"></div>
        </div>
      </main>
      <!-- Step Property Panel: fixed right column -->
      <div id="step-prop-panel" class="prop-panel prop-panel-hidden">
        <div class="prop-panel-header">
          <span class="prop-panel-title" id="prop-panel-title">环节属性</span>
          <button class="prop-panel-close" onclick="closeStepPanel()" title="关闭">×</button>
        </div>
        <div class="prop-panel-body" id="prop-panel-body">
          <!-- filled by renderStepPanel() -->
        </div>
      </div>
    </div>
  `;
}

// ===== Render All =====
function renderAll() {
  renderStepsList();
  renderPreview();
}

// ===== Navigate preview to step =====
function scrollPreviewToStep(stepId) {
  // Use requestAnimationFrame to ensure DOM is ready after render
  requestAnimationFrame(() => {
    const scrollWrap = document.getElementById('preview-scroll-wrap');
    if (!scrollWrap) return;

    // Find the element with data-step-id in the preview canvas
    // Table layout: qt-col-header, Timeline layout: tl-title-cell
    const canvas = document.getElementById('preview-canvas');
    if (!canvas) return;

    let target =
      canvas.querySelector(`.qt-col-header [data-step-id="${stepId}"]`)?.closest('.qt-step-cell') ||
      canvas.querySelector(`.tl-title-cell [data-step-id="${stepId}"]`)?.closest('.tl-title-cell') ||
      canvas.querySelector(`[data-step-id="${stepId}"]`);

    if (!target) return;

    // Calculate position to center the target horizontally in the scroll wrap
    const wrapRect   = scrollWrap.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const scrollLeft = scrollWrap.scrollLeft + targetRect.left - wrapRect.left
                       - wrapRect.width / 2 + targetRect.width / 2;

    scrollWrap.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
  });
}

// ===== Batch Mode =====
let _batchMode = false;
let _batchSelected = new Set();

function toggleBatchMode() {
  _batchMode = !_batchMode;
  if (!_batchMode) _batchSelected.clear();
  renderStepsList();
}

function selectAllSteps() {
  STATE.steps.forEach(s => _batchSelected.add(s.id));
  renderStepsList();
}

function batchDeleteSteps() {
  if (_batchSelected.size === 0) { showToast('请先选择环节'); return; }
  STATE.steps = STATE.steps.filter(s => !_batchSelected.has(s.id));
  if (_batchSelected.has(STATE.activeStepId)) STATE.activeStepId = null;
  _batchSelected.clear();
  _batchMode = false;
  const qdd = getCurrentQdd(); if (qdd) { syncQddFromState(qdd); saveAllQdds(); }
  renderAll();
  showToast('已批量删除');
}

// ===== Render Steps List (Left Panel) =====
function renderStepsList() {
  const $stepCount = document.getElementById('step-count');
  const $stepsList = document.getElementById('steps-list');
  if (!$stepCount || !$stepsList) return;
  $stepCount.textContent = `${STATE.steps.length} 个环节`;

  // Batch toggle button in header
  const batchToggleBtn = document.getElementById('slBatchToggle');
  if (batchToggleBtn) {
    batchToggleBtn.textContent = _batchMode ? '退出批量' : '批量操作';
    batchToggleBtn.classList.toggle('active', _batchMode);
  }
  // Batch action bar
  const batchBar = document.getElementById('slBatchBar');
  if (batchBar) batchBar.classList.toggle('hidden', !_batchMode);

  $stepsList.innerHTML = '';

  STATE.steps.forEach((step, i) => {
    const item = document.createElement('div');
    const isActive = STATE.activeStepId === step.id;
    const isChecked = _batchSelected.has(step.id);
    item.className = 'step-item'
      + (isActive ? ' active' : '')
      + (isChecked ? ' batch-selected' : '');
    item.dataset.id = step.id;
    item.draggable = !_batchMode;
    const typeLabel = step.taskType ? ` <span class="step-type-badge">${step.taskType}</span>` : '';
    if (_batchMode) {
      item.innerHTML = `
        <input type="checkbox" class="batch-cb" ${isChecked ? 'checked' : ''}>
        <span class="step-color-dot" style="background:${getStepColor(step, i)}"></span>
        <span class="step-item-name">${esc(step.name || '未命名环节')}${typeLabel}</span>
      `;
      item.addEventListener('click', e => {
        if (isChecked) _batchSelected.delete(step.id);
        else _batchSelected.add(step.id);
        renderStepsList();
      });
    } else {
      item.innerHTML = `
        <span class="step-drag-handle" title="拖拽排序">⠿</span>
        <span class="step-color-dot" style="background:${getStepColor(step, i)}"></span>
        <span class="step-item-name">${esc(step.name || '未命名环节')}${typeLabel}</span>
        <span class="step-item-actions">
          <button title="编辑" onclick="openStepEditor('${step.id}')">✏️</button>
          <button title="上移" onclick="moveStep('${step.id}', -1)">▲</button>
          <button title="下移" onclick="moveStep('${step.id}', 1)">▼</button>
          <button class="del-btn" title="删除" onclick="deleteStep('${step.id}')">🗑</button>
        </span>
      `;
      item.addEventListener('click', e => {
        if (e.target.closest('.step-item-actions')) return;
        STATE.activeStepId = step.id;
        renderStepsList();
        scrollPreviewToStep(step.id);
      });
      item.addEventListener('dragstart', dragStart);
      item.addEventListener('dragover', dragOver);
      item.addEventListener('drop', dragDrop);
      item.addEventListener('dragend', dragEnd);
    }
    $stepsList.appendChild(item);
  });
}

// ===== Drag & Drop =====
let dragSrcId = null;
function dragStart(e) {
  dragSrcId = e.currentTarget.dataset.id;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}
function dragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}
function dragDrop(e) {
  e.preventDefault();
  const targetId = e.currentTarget.dataset.id;
  if (dragSrcId && targetId && dragSrcId !== targetId) {
    const si = STATE.steps.findIndex(s => s.id === dragSrcId);
    const ti = STATE.steps.findIndex(s => s.id === targetId);
    const [moved] = STATE.steps.splice(si, 1);
    STATE.steps.splice(ti, 0, moved);
    renderAll();
  }
}
function dragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  dragSrcId = null;
}

// ===== Step CRUD =====
function moveStep(id, dir) {
  const i = STATE.steps.findIndex(s => s.id === id);
  const j = i + dir;
  if (j < 0 || j >= STATE.steps.length) return;
  [STATE.steps[i], STATE.steps[j]] = [STATE.steps[j], STATE.steps[i]];
  const qdd = getCurrentQdd(); if (qdd) { syncQddFromState(qdd); saveAllQdds(); }
  renderAll();
}

function deleteStep(id) {
  STATE.steps = STATE.steps.filter(s => s.id !== id);
  if (STATE.activeStepId === id) STATE.activeStepId = null;
  const qdd = getCurrentQdd(); if (qdd) { syncQddFromState(qdd); saveAllQdds(); }
  renderAll();
  showToast('环节已删除');
}

// ===== Step Editor Modal =====
function openStepEditor(id) {
  STATE.editingStepId = id;
  const step = id ? STATE.steps.find(s => s.id === id) : null;
  const modal = document.getElementById('step-editor');
  modal.classList.remove('hidden');

  const title = step ? `编辑环节：${step.name}` : '新增环节';
  const currentTaskType = step?.taskType || '';
  // Color: use colorOverride if set, else derive from taskType, else preset
  const defaultColor = currentTaskType && TASK_TYPE_MAP[currentTaskType]
    ? TASK_TYPE_MAP[currentTaskType].color
    : (PRESET_COLORS[STATE.steps.length % PRESET_COLORS.length]);
  const selectedColor = step?.colorOverride || step?.color || defaultColor;

  const taskTypeOptionsHtml = TASK_TYPES.map(t =>
    `<option value="${t.value}"${t.value === currentTaskType ? ' selected' : ''}>${t.label}</option>`
  ).join('');

  const triggerOptionsHtml = ['', ...TRIGGER_OPTIONS].map(v =>
    `<option value="${v}"${v === (step?.trigger||'') ? ' selected' : ''}>${v || '—'}</option>`
  ).join('');

  const colorDotsHtml = PRESET_COLORS.map(c =>
    `<span class="color-preset-dot${c === selectedColor ? ' selected' : ''}" style="background:${c}" data-color="${c}" onclick="selectPresetColor('${c}')"></span>`
  ).join('');

  const customFieldsHtml = (step?.customFields || []).map((f, fi) =>
    renderCustomFieldRow(fi, f.key, f.value)
  ).join('');

  modal.innerHTML = `
    <div class="editor-modal">
      <div class="editor-modal-header">
        <h3>${title}</h3>
        <button class="editor-modal-close" onclick="closeStepEditor()">×</button>
      </div>
      <div class="editor-modal-body">
        <div class="form-row">
          <label>环节名称 *</label>
          <input type="text" id="ef-name" placeholder="如：0.任务接取" value="${esc(step?.name||'')}">
        </div>
        <div class="form-grid-2">
          <div class="form-row">
            <label>任务类型</label>
            <select id="ef-tasktype" onchange="onTaskTypeChange(this.value)">
              ${taskTypeOptionsHtml}
            </select>
          </div>
          <div class="form-row">
            <label>触发方式</label>
            <select id="ef-trigger">
              ${triggerOptionsHtml}
            </select>
          </div>
          <div class="form-row">
            <label>位置</label>
            <input type="text" id="ef-location" placeholder="如：武康大楼·大厅" value="${esc(step?.location||'')}">
          </div>
        </div>
        <div class="form-row">
          <label>出场人物</label>
          <input type="text" id="ef-characters" placeholder="如：柚柠, 程醒" value="${esc(step?.characters||'')}">
        </div>
        <div class="form-row">
          <label>环节描述</label>
          <textarea id="ef-desc" placeholder="描述环节发生的事情...">${esc(step?.desc||'')}</textarea>
        </div>
        <div class="form-row">
          <label>配图</label>
          <div class="image-upload-area" id="ef-image-drop-zone">
            <div class="image-upload-preview" id="ef-image-preview">
              ${step?.imageUrl ? `<img src="${esc(step.imageUrl)}" alt="预览">` : '<span class="image-upload-hint">📷 拖入图片 / Ctrl+V 粘贴 / 点击选择</span>'}
            </div>
            <div class="image-upload-actions">
              <button type="button" class="img-action-btn" onclick="triggerImageFileSelect()">📂 本地选择</button>
              <button type="button" class="img-action-btn img-clear-btn" onclick="clearImageField()" id="ef-image-clear" ${step?.imageUrl ? '' : 'style="display:none"'}>✕ 清除</button>
              <input type="file" id="ef-image-file" accept="image/*" style="display:none" onchange="handleImageFileChange(this)">
            </div>
            <div class="image-upload-url-row">
              <input type="url" id="ef-image" placeholder="或填入网络图片地址 https://..." value="${esc(step?.imageUrl||'')}" oninput="handleImageUrlInput(this.value)">
            </div>
          </div>
        </div>
        <div class="form-row">
          <label>环节颜色</label>
          <div class="color-row">
            <div class="color-presets" id="color-presets">${colorDotsHtml}</div>
            <input type="color" id="ef-color-picker" value="${selectedColor}" style="width:32px;height:32px;border:none;background:none;cursor:pointer;padding:0;border-radius:4px;" title="自定义颜色" onchange="syncPickerColor(this.value)">
          </div>
        </div>
        <div class="custom-fields-section">
          <h4>🔧 自定义字段</h4>
          <div id="custom-fields-list">${customFieldsHtml}</div>
          <button class="add-custom-field-btn" onclick="addCustomFieldRow()">＋ 添加自定义字段</button>
        </div>
      </div>
      <div class="editor-modal-footer">
        <button class="btn-cancel" onclick="closeStepEditor()">取消</button>
        <button class="btn-primary" onclick="saveStep()">保存</button>
      </div>
    </div>
  `;
  // Set initial color picker hidden input
  modal.querySelector('#ef-color-picker').dataset.selected = selectedColor;
  // Bind image drop zone events
  bindImageDropZone();
}

function renderCustomFieldRow(index, key='', value='') {
  return `
    <div class="custom-field-row" data-fi="${index}">
      <input type="text" placeholder="字段名" value="${esc(key)}" class="cf-key">
      <input type="text" placeholder="值" value="${esc(value)}" class="cf-val">
      <button class="custom-field-del" onclick="removeCustomFieldRow(this)">✕</button>
    </div>
  `;
}

function addCustomFieldRow() {
  const list = document.getElementById('custom-fields-list');
  const div = document.createElement('div');
  div.innerHTML = renderCustomFieldRow(Date.now());
  list.appendChild(div.firstElementChild);
}

function removeCustomFieldRow(btn) {
  btn.closest('.custom-field-row').remove();
}

function selectPresetColor(color) {
  document.querySelectorAll('.color-preset-dot').forEach(d => d.classList.remove('selected'));
  const dot = document.querySelector(`.color-preset-dot[data-color="${color}"]`);
  if (dot) dot.classList.add('selected');
  const picker = document.getElementById('ef-color-picker');
  if (picker) { picker.value = color; picker.dataset.selected = color; }
}

function syncPickerColor(color) {
  document.querySelectorAll('.color-preset-dot').forEach(d => d.classList.remove('selected'));
  const picker = document.getElementById('ef-color-picker');
  if (picker) picker.dataset.selected = color;
}

function getSelectedColor() {
  const picker = document.getElementById('ef-color-picker');
  return picker?.dataset.selected || picker?.value || PRESET_COLORS[0];
}

function onTaskTypeChange(typeVal) {
  // Auto-fill color from taskType, but allow manual override afterwards
  if (typeVal && TASK_TYPE_MAP[typeVal]) {
    const autoColor = TASK_TYPE_MAP[typeVal].color;
    selectPresetColor(autoColor);
    // Also update the color picker
    const picker = document.getElementById('ef-color-picker');
    if (picker) { picker.value = autoColor; picker.dataset.selected = autoColor; }
  }
}

function closeStepEditor() {
  document.getElementById('step-editor').classList.add('hidden');
  STATE.editingStepId = null;
}

function saveStep() {
  const name = document.getElementById('ef-name').value.trim();
  if (!name) { alert('请填写环节名称！'); return; }

  const customFields = [];
  document.querySelectorAll('#custom-fields-list .custom-field-row').forEach(row => {
    const key = row.querySelector('.cf-key').value.trim();
    const val = row.querySelector('.cf-val').value.trim();
    if (key) customFields.push({ key, value: val });
  });

  const taskType = document.getElementById('ef-tasktype')?.value || '';
  const autoColor = taskType && TASK_TYPE_MAP[taskType] ? TASK_TYPE_MAP[taskType].color : null;
  const pickedColor = getSelectedColor();
  // colorOverride = manual if it differs from the auto color for this taskType
  const colorOverride = (autoColor && pickedColor !== autoColor) ? pickedColor : null;

  const data = {
    name,
    taskType,
    trigger: document.getElementById('ef-trigger')?.value || '',
    location: document.getElementById('ef-location').value.trim(),
    characters: document.getElementById('ef-characters').value.trim(),
    desc: document.getElementById('ef-desc').value.trim(),
    imageUrl: document.getElementById('ef-image').value.trim(),
    color: pickedColor,
    colorOverride,
    customFields,
  };

  const wasEditing = STATE.editingStepId;
  if (wasEditing) {
    const i = STATE.steps.findIndex(s => s.id === wasEditing);
    if (i >= 0) STATE.steps[i] = { ...STATE.steps[i], ...data };
  } else {
    STATE.steps.push({ id: genId(), ...data });
  }

  // Auto-save to localStorage
  const qdd = getCurrentQdd();
  if (qdd) { syncQddFromState(qdd); saveAllQdds(); }

  closeStepEditor();
  renderAll();
  showToast(wasEditing ? '环节已更新' : '环节已添加');
}

// ===== Preview Render =====
function renderPreview() {
  const $previewCanvas = document.getElementById('preview-canvas');
  if (!$previewCanvas) return;
  if (STATE.steps.length === 0) {
    $previewCanvas.innerHTML = `
      <div class="preview-empty">
        <div class="empty-icon">🗺️</div>
        <p>还没有环节，点击右上角「➕ 添加环节」开始设计你的 QDD 流程图</p>
      </div>`;
    return;
  }
  if (STATE.layout === 'table') renderTableLayout();
  else renderTimelineLayout();
}

// ===== TABLE LAYOUT =====
// Structure (matches reference image exactly):
//   Outer table  : one <td> per step, side by side
//   Inside each <td> : a nested 2-col table  [label | value] for each field
//   Image        : spans full cell width at top
//   Description  : spans full cell width at bottom
//   No cross-column row alignment needed — each column is self-contained.
function renderTableLayout() {
  const $previewCanvas = document.getElementById('preview-canvas');
  if (!$previewCanvas) return;
  const title = document.getElementById('questTitle')?.value || STATE.questTitle;

  const customKeys = [];
  STATE.steps.forEach(s => {
    (s.customFields || []).forEach(f => {
      if (f.key && !customKeys.includes(f.key)) customKeys.push(f.key);
    });
  });

  const fieldDefs = [
    { label: '触发方式', field: 'trigger', type: 'trigger-select' },
    { label: '位置',     field: 'location' },
    { label: '出场人物', field: 'characters' },
    ...customKeys.map(k => ({ label: k, field: k, custom: true })),
  ];

  // Build each step column cell
  const stepCells = STATE.steps.map((step, i) => {
    const color = getStepColor(step, i);
    const customMap = {};
    (step.customFields || []).forEach(f => { customMap[f.key] = f.value; });

    // ── Colored title header ──
    const typeInfo = step.taskType && TASK_TYPE_MAP[step.taskType] ? TASK_TYPE_MAP[step.taskType] : null;
    const badgeHtml = `<span class="qt-type-badge" data-step-id="${step.id}" onclick="toggleTypeDropdown(event,'${step.id}')" title="点击切换任务类型">${typeInfo ? typeInfo.label.split(' ')[0] : '＋类型'}</span>`;
    const indexTag = step.index ? `<span class="qt-col-index" title="环节编号 #${esc(step.index)}">#${esc(step.index)}</span>` : '';
    const header = `<div class="qt-col-header" style="background:${color}" onclick="openStepPanel('${step.id}')" title="点击打开属性面板">
      <div class="qt-col-header-inner">
        ${indexTag}<span class="qt-editable" contenteditable="true" data-step-id="${step.id}" data-field="name" onclick="event.stopPropagation()">${esc(step.name)}</span>
        ${badgeHtml}
      </div>
    </div>`;

    // ── Image: support multiple images ──
    const imgs = step.images && step.images.length > 0
      ? step.images
      : (step.imageUrl ? [step.imageUrl] : []);
    const imgInner = imgs.length > 0
      ? imgs.map((url, ii) => `
          <div class="qt-img-zone qt-img-has-img qt-img-thumb" data-step-id="${step.id}" tabindex="0"
               title="双击放大" ondblclick="openImagePreview('${esc(url)}')">
            <img src="${esc(url)}" loading="lazy" onerror="this.style.display='none'">
          </div>`).join('')
      : '';
    const img = `<div class="qt-col-img qt-img-zone${imgs.length === 0 ? ' qt-col-img-empty' : ''} qt-img-multi-wrap" data-step-id="${step.id}" tabindex="0">
      ${imgInner}
      ${imgs.length === 0 ? '<span class="qt-img-empty-hint">� 拖入或 Ctrl+V 粘贴图片</span>' : ''}
    </div>`;

    // ── Fields: nested 2-col table [label | value] — skip empty rows ──
    const fieldRows = fieldDefs.map(fd => {
      const val = fd.custom ? (customMap[fd.field] || '') : (step[fd.field] || '');
      if (fd.type === 'trigger-select') {
        // Always show trigger row (allows clicking to set); if empty show placeholder
        const displayVal = val || '—';
        return `<tr>
          <td class="qt-fl">${esc(fd.label)}：</td>
          <td class="qt-fv qt-fv-select" data-step-id="${step.id}" data-field="trigger"
              onclick="toggleTriggerDropdown(event,'${step.id}')" title="点击选择触发方式">${esc(displayVal)}<span class="qt-select-arrow">▾</span></td>
        </tr>`;
      }
      // Skip row entirely if value is empty
      if (!val) return '';
      return `<tr>
        <td class="qt-fl">${esc(fd.label)}：</td>
        <td class="qt-fv" contenteditable="true"
          data-step-id="${step.id}" data-field="${fd.field}"
          data-custom="${fd.custom ? '1' : '0'}">${esc(val)}</td>
      </tr>`;
    }).join('');
    const fields = `<table class="qt-fields-table" cellspacing="0" cellpadding="0">${fieldRows}</table>`;

    // ── Description ──
    const desc = `<div class="qt-col-desc" contenteditable="true"
      data-step-id="${step.id}" data-field="desc">${escWithBr(step.desc || '')}</div>`;

    return `<td class="qt-step-cell" valign="top">
      <div class="qt-step-inner">${header}${img}${fields}${desc}</div>
    </td>`;
  }).join('');

  $previewCanvas.innerHTML = `
    <div class="table-wrap">
      <div class="table-title-bar">
        ${esc(title)}
        <button class="table-copy-btn" onclick="copyTableToClipboard()" title="复制整张表，可直接粘贴到 Excel / 飞书表格">📋 复制到表格</button>
      </div>
      <div class="qt-scroll">
        <table class="qt-table" cellspacing="0" cellpadding="0">
          <tbody><tr>${stepCells}</tr></tbody>
        </table>
      </div>
    </div>`;

  // Bind contenteditable
  $previewCanvas.querySelectorAll('[contenteditable]').forEach(el => {
    el.addEventListener('blur', onTableCellBlur);
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey && !el.classList.contains('qt-col-desc')) {
        e.preventDefault(); el.blur();
      }
    });
  });

  // Bind inline image drop zones
  bindInlineImageZones($previewCanvas);
}

// ===== Copy Table to Clipboard =====
// Flat multi-row HTML table (no nesting). Each step = 2 cols (label|value).
// Field rows: only show a row if at least ONE step has a value for that field.
// For steps without a value in that row → show empty cells (no label, no dash).
function copyTableToClipboard() {
  const steps = STATE.steps;
  if (!steps.length) { showToast('⚠️ 没有环节可复制'); return; }

  // Helper: escape HTML
  const h = str => String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  // Helper: hex → rgba
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  const B = `border:1px solid #bbb;`;
  const fnt = `font-family:微软雅黑,Arial,sans-serif;font-size:11px;`;
  // cell style builders
  const cs  = extra => `${B}${fnt}${extra}`;
  const lbl = color  => cs(`padding:3px 5px;background:#f0f0f0;color:#555;font-weight:600;white-space:nowrap;vertical-align:top;`);
  const val = color  => cs(`padding:3px 6px;background:${hexToRgba(color,0.05)};vertical-align:top;word-break:break-word;`);
  const emp = ()     => cs(`padding:0;background:#fff;`); // empty placeholder cell

  // Collect all field defs in order: fixed fields first, then all custom keys seen across steps
  const customKeys = [];
  steps.forEach(s => (s.customFields||[]).forEach(f => { if(f.key && !customKeys.includes(f.key)) customKeys.push(f.key); }));

  const allFields = [
    { key: '__trigger',    label: '触发方式', get: s => s.trigger || '' },
    { key: '__location',   label: '位置',     get: s => s.location || '' },
    { key: '__characters', label: '出场人物', get: s => s.characters || '' },
    ...customKeys.map(k => ({
      key: k, label: k,
      get: s => { const cf = (s.customFields||[]).find(f=>f.key===k); return cf ? (cf.value||'') : ''; }
    })),
  ];

  // Only keep field rows where at least one step has a non-empty value
  const activeFields = allFields.filter(fd => steps.some(s => fd.get(s).trim() !== ''));

  // ── Row 1: image row — each step spans 2 cols ──
  const imgCells = steps.map((step, i) => {
    const color = getStepColor(step, i);
    const imgs = step.images && step.images.length > 0 ? step.images : (step.imageUrl ? [step.imageUrl] : []);
    const inner = imgs.length > 0
      ? imgs.map(url => `<img src="${h(url)}" style="max-width:160px;max-height:110px;display:inline-block;margin:2px;">`).join('')
      : `<span style="${fnt}color:#aaa;">🖼 在属性面板添加配图</span>`;
    return `<td colspan="2" style="${B}${fnt}padding:5px;text-align:center;vertical-align:middle;background:${hexToRgba(color,0.07)};height:80px;">${inner}</td>`;
  }).join('');

  // ── Row 2: title row — each step spans 2 cols ──
  const titleCells = steps.map((step, i) => {
    const color = getStepColor(step, i);
    const typeInfo = step.taskType && TASK_TYPE_MAP[step.taskType] ? TASK_TYPE_MAP[step.taskType] : null;
    const badge = typeInfo
      ? `<br><span style="display:inline-block;margin-top:3px;padding:1px 9px;border-radius:9px;font-size:10px;font-weight:700;background:rgba(0,0,0,0.32);color:#fff;">${h(typeInfo.value)}</span>`
      : '';
    return `<td colspan="2" style="${B}${fnt}padding:7px 6px;background:${color};color:#fff;font-weight:700;font-size:13px;text-align:center;text-shadow:0 1px 2px rgba(0,0,0,0.3);line-height:1.4;">${h(step.name||'未命名环节')}${badge}</td>`;
  }).join('');

  // ── Field rows with rowspan merging ──
  // For each step (column), merge consecutive empty field rows into one spanning cell.
  // Build a 2D grid: grid[rowIdx][stepIdx] = { html, skip }
  //   html  = the <td> pair string to emit
  //   skip  = true means this cell was absorbed into a rowspan above, don't emit

  const nRows = activeFields.length;
  const nSteps = steps.length;

  // grid[row][col] = { html: string, skip: bool }
  const grid = Array.from({length: nRows}, () => Array.from({length: nSteps}, () => ({html:'', skip:false})));

  steps.forEach((step, si) => {
    const color = getStepColor(step, si);
    const bg = hexToRgba(color, 0.05);

    // Mark which rows are empty for this step
    const isEmpty = activeFields.map(fd => fd.get(step).trim() === '');

    let ri = 0;
    while (ri < nRows) {
      if (!isEmpty[ri]) {
        // Has value — normal label+value pair
        const fd = activeFields[ri];
        const v  = fd.get(step).trim();
        grid[ri][si].html = `<td style="${lbl(color)}">${h(fd.label)}：</td><td style="${val(color)}">${h(v)}</td>`;
        ri++;
      } else {
        // Find the run of consecutive empty rows for this step
        let runEnd = ri;
        while (runEnd < nRows && isEmpty[runEnd]) runEnd++;
        const span = runEnd - ri;

        // Emit one merged empty cell spanning `span` rows (colspan=2, rowspan=span)
        const spanAttr = span > 1 ? ` rowspan="${span}"` : '';
        grid[ri][si].html = `<td colspan="2"${spanAttr} style="${B}${fnt}padding:0;background:${bg};"></td>`;
        // Mark subsequent rows in this run as skip
        for (let k = ri + 1; k < runEnd; k++) {
          grid[k][si].skip = true;
        }
        ri = runEnd;
      }
    }
  });

  // Assemble rows
  const fieldRowsHtml = Array.from({length: nRows}, (_, ri) => {
    const cells = steps.map((_, si) => {
      if (grid[ri][si].skip) return '';
      return grid[ri][si].html;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  // ── Description row — each step spans 2 cols ──
  const hasDesc = steps.some(s => (s.desc||'').trim());
  const descRowHtml = hasDesc ? `<tr>${steps.map((step,i) => {
    const color = getStepColor(step, i);
    const desc = (step.desc||'').trim().replace(/\n/g,'<br>');
    return `<td colspan="2" style="${B}${fnt}padding:6px 7px;vertical-align:top;background:${hexToRgba(color,0.05)};word-break:break-word;line-height:1.6;">${desc}</td>`;
  }).join('')}</tr>` : '';

  const tableHtml = `<table style="border-collapse:collapse;" cellspacing="0" cellpadding="0"><tbody>
    <tr>${imgCells}</tr>
    <tr>${titleCells}</tr>
    ${fieldRowsHtml}
    ${descRowHtml}
  </tbody></table>`;

  // Write both HTML and plain-text to clipboard
  const plainText = steps.map(s => {
    const lines = [s.name || '未命名环节'];
    if (s.trigger)    lines.push(`触发方式：${s.trigger}`);
    if (s.location)   lines.push(`位置：${s.location}`);
    if (s.characters) lines.push(`出场人物：${s.characters}`);
    (s.customFields||[]).forEach(f => { if(f.key) lines.push(`${f.key}：${f.value||''}`); });
    if (s.desc) lines.push(s.desc);
    return lines.join('\n');
  }).join('\n\n');

  try {
    const clipItem = new ClipboardItem({
      'text/html':  new Blob([tableHtml], { type: 'text/html' }),
      'text/plain': new Blob([plainText],  { type: 'text/plain' }),
    });
    navigator.clipboard.write([clipItem]).then(() => {
      showToast('✅ 已复制！可直接粘贴到飞书/Excel 表格（保留格式）');
    }).catch(err => {
      console.warn('ClipboardItem write failed, fallback:', err);
      _copyHtmlFallback(tableHtml, plainText);
    });
  } catch(e) {
    _copyHtmlFallback(tableHtml, plainText);
  }
}

function _copyHtmlFallback(html, plain) {
  // Use a hidden contenteditable div to write rich HTML to clipboard
  const div = document.createElement('div');
  div.contentEditable = 'true';
  div.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
  div.innerHTML = html;
  document.body.appendChild(div);
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(div);
  sel.removeAllRanges();
  sel.addRange(range);
  try {
    document.execCommand('copy');
    showToast('✅ 已复制！可直接粘贴到飞书/Excel 表格（保留格式）');
  } catch(e) {
    // Last resort: plain text
    const ta = document.createElement('textarea');
    ta.value = plain;
    ta.style.cssText = 'position:fixed;top:-9999px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('✅ 已复制（纯文本格式）');
  }
  document.body.removeChild(div);
}

function onTableCellBlur(e) {
  const el = e.currentTarget;
  const stepId = el.dataset.stepId;
  const field = el.dataset.field;
  const isCustom = el.dataset.custom === '1';
  const val = el.innerText.trim();

  const step = STATE.steps.find(s => s.id === stepId);
  if (!step) return;

  if (isCustom) {
    const cf = (step.customFields || []).find(f => f.key === field);
    if (cf) cf.value = val;
  } else {
    step[field] = val;
  }
  // Update quest title display if name changed
  if (field === 'name') renderStepsList();

  // ── Persist: sync back to STORE and save to localStorage ──
  const qdd = getCurrentQdd();
  if (qdd) { syncQddFromState(qdd); saveAllQdds(); }
}

// ===== Step Property Panel =====
let _propPanelStepId = null;

function openStepPanel(stepId) {
  // Toggle: clicking same header again closes the panel
  if (_propPanelStepId === stepId) {
    closeStepPanel();
    return;
  }
  _propPanelStepId = stepId;
  STATE.activeStepId = stepId;
  renderStepsList(); // highlight active in left list

  const panel = document.getElementById('step-prop-panel');
  if (!panel) return;
  panel.classList.remove('prop-panel-hidden');
  renderStepPanel();
}

function closeStepPanel() {
  _propPanelStepId = null;
  const panel = document.getElementById('step-prop-panel');
  if (panel) panel.classList.add('prop-panel-hidden');
  // Remove active highlight
  STATE.activeStepId = null;
  renderStepsList();
}

function renderStepPanel() {
  const body = document.getElementById('prop-panel-body');
  const titleEl = document.getElementById('prop-panel-title');
  if (!body) return;

  const step = STATE.steps.find(s => s.id === _propPanelStepId);
  if (!step) { closeStepPanel(); return; }

  if (titleEl) titleEl.textContent = step.name || '未命名环节';

  // Ensure step has images array (backwards compat)
  if (!step.images) step.images = step.imageUrl ? [step.imageUrl] : [];

  // Task type options
  const taskTypeOpts = TASK_TYPES.map(t =>
    `<option value="${esc(t.value)}"${t.value === (step.taskType||'') ? ' selected' : ''}>${esc(t.label)}</option>`
  ).join('');

  // Trigger options
  const triggerOpts = ['', ...TRIGGER_OPTIONS].map(v =>
    `<option value="${esc(v)}"${v === (step.trigger||'') ? ' selected' : ''}>${v || '—'}</option>`
  ).join('');

  // Custom fields rows
  const cfRows = (step.customFields || []).map((f, fi) => `
    <div class="pp-cf-row" data-fi="${fi}">
      <input class="pp-cf-key" type="text" placeholder="参数名" value="${esc(f.key)}"
        onchange="updateCustomFieldKey('${step.id}',${fi},this.value)">
      <input class="pp-cf-val" type="text" placeholder="参数值" value="${esc(f.value)}"
        onchange="updateCustomFieldVal('${step.id}',${fi},this.value)">
      <button class="pp-cf-del" onclick="deleteCustomField('${step.id}',${fi})" title="删除此字段">×</button>
    </div>`).join('');

  // Images list
  const imgItems = (step.images || []).map((url, ii) => `
    <div class="pp-img-item" data-ii="${ii}">
      <img src="${esc(url)}" alt="图${ii+1}" onclick="openImagePreview('${esc(url)}')">
      <button class="pp-img-del" onclick="deletePanelImage('${step.id}',${ii})" title="删除">×</button>
    </div>`).join('');

  body.innerHTML = `
    <div class="pp-section">
      <label class="pp-label">环节名称</label>
      <input class="pp-input" type="text" id="pp-name" value="${esc(step.name||'')}"
        oninput="savePanelField('${step.id}','name',this.value)">
    </div>

    <div class="pp-section pp-row2">
      <div>
        <label class="pp-label">任务类型</label>
        <select class="pp-select" id="pp-tasktype"
          onchange="savePanelTaskType('${step.id}',this.value)">${taskTypeOpts}</select>
      </div>
      <div>
        <label class="pp-label">触发方式</label>
        <select class="pp-select" id="pp-trigger"
          onchange="savePanelField('${step.id}','trigger',this.value)">${triggerOpts}</select>
      </div>
    </div>

    <div class="pp-section">
      <label class="pp-label">位置</label>
      <input class="pp-input" type="text" id="pp-location" placeholder="如：武康大楼·大厅"
        value="${esc(step.location||'')}" oninput="savePanelField('${step.id}','location',this.value)">
    </div>

    <div class="pp-section">
      <label class="pp-label">出场人物</label>
      <input class="pp-input" type="text" id="pp-characters" placeholder="如：柚柠, 程醒"
        value="${esc(step.characters||'')}" oninput="savePanelField('${step.id}','characters',this.value)">
    </div>

    <div class="pp-section">
      <label class="pp-label">描述</label>
      <textarea class="pp-textarea" id="pp-desc"
        oninput="savePanelField('${step.id}','desc',this.value)">${esc(step.desc||'')}</textarea>
    </div>

    <div class="pp-section">
      <label class="pp-label">配图
        <button class="pp-img-add-btn" onclick="addPanelImage('${step.id}')" title="从文件选择">＋ 添加</button>
      </label>
      <div class="pp-img-list" id="pp-img-list-${step.id}">
        ${imgItems}
        <div class="pp-img-drop-zone" data-step-id="${step.id}"
          onclick="addPanelImage('${step.id}')"
          tabindex="0"
          title="点击添加 / 拖入图片 / Ctrl+V">
          📷 拖入或点击添加
        </div>
      </div>
    </div>

    <div class="pp-section">
      <label class="pp-label">自定义字段
        <button class="pp-cf-add-btn" onclick="addCustomField('${step.id}')">＋ 添加字段</button>
      </label>
      <div class="pp-cf-list" id="pp-cf-list">${cfRows}</div>
    </div>

    <div class="pp-section pp-danger-zone">
      <button class="pp-del-step-btn" onclick="deletePanelStep('${step.id}')">🗑 删除此环节</button>
      <button class="pp-add-step-btn" onclick="addStep()">＋ 在此后新增环节</button>
    </div>
  `;

  // Bind drag-drop on the image drop zone
  bindPanelImageDropZone(step.id);
}

// ── Panel field savers ──
function savePanelField(stepId, field, val) {
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step) return;
  step[field] = val;
  saveAllQdds();
  // Live-refresh preview without closing panel
  if (field === 'name') {
    const titleEl = document.getElementById('prop-panel-title');
    if (titleEl) titleEl.textContent = val || '未命名环节';
    renderStepsList();
  }
  // Partial re-render: just re-render the preview (fast)
  renderPreview();
}

function savePanelTaskType(stepId, typeValue) {
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step) return;
  step.taskType = typeValue;
  step.colorOverride = null;
  saveAllQdds();
  renderStepsList();
  renderPreview();
}

function updateCustomFieldKey(stepId, fi, val) {
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step || !step.customFields[fi]) return;
  step.customFields[fi].key = val;
  saveAllQdds();
  renderPreview();
}
function updateCustomFieldVal(stepId, fi, val) {
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step || !step.customFields[fi]) return;
  step.customFields[fi].value = val;
  saveAllQdds();
  renderPreview();
}
function addCustomField(stepId) {
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step) return;
  if (!step.customFields) step.customFields = [];
  step.customFields.push({ key: '', value: '' });
  saveAllQdds();
  renderStepPanel();
  renderPreview();
}
function deleteCustomField(stepId, fi) {
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step) return;
  step.customFields.splice(fi, 1);
  saveAllQdds();
  renderStepPanel();
  renderPreview();
}

function deletePanelStep(stepId) {
  if (!confirm('确认删除此环节？')) return;
  STATE.steps = STATE.steps.filter(s => s.id !== stepId);
  const qdd = getCurrentQdd(); if (qdd) { syncQddFromState(qdd); saveAllQdds(); }
  closeStepPanel();
  renderAll();
  showToast('环节已删除');
}

function getPrevStepDefaults() {
  // Get the step that is currently active/open in the panel, or the last step
  const refId = _propPanelStepId || (STATE.steps.length > 0 ? STATE.steps[STATE.steps.length - 1].id : null);
  const ref = refId ? STATE.steps.find(s => s.id === refId) : null;
  if (!ref) return {};
  return {
    trigger:    ref.trigger    || '',
    location:   ref.location   || '',
    characters: ref.characters || '',
    taskType:   ref.taskType   || '',
  };
}

function addStep() {
  const defaults = getPrevStepDefaults();
  const newStep = {
    id: genId(), name: '新环节',
    trigger:    defaults.trigger,
    location:   defaults.location,
    characters: defaults.characters,
    taskType:   defaults.taskType,
    desc: '', imageUrl: '', images: [], color: '', customFields: [],
  };
  // Insert after active step, or at end
  const idx = _propPanelStepId
    ? STATE.steps.findIndex(s => s.id === _propPanelStepId)
    : -1;
  if (idx >= 0) STATE.steps.splice(idx + 1, 0, newStep);
  else STATE.steps.push(newStep);
  const qdd = getCurrentQdd(); if (qdd) { syncQddFromState(qdd); saveAllQdds(); }
  renderAll();
  openStepPanel(newStep.id);
}

function addMultipleSteps() {
  const countInput = document.getElementById('addCountInput');
  const count = Math.max(1, Math.min(20, parseInt(countInput?.value || '1', 10)));
  const defaults = getPrevStepDefaults();
  for (let i = 0; i < count; i++) {
    STATE.steps.push({
      id: genId(), name: `新环节`,
      trigger:    defaults.trigger,
      location:   defaults.location,
      characters: defaults.characters,
      taskType:   defaults.taskType,
      desc: '', imageUrl: '', images: [], color: '', customFields: [],
    });
  }
  const qdd = getCurrentQdd(); if (qdd) { syncQddFromState(qdd); saveAllQdds(); }
  renderAll();
  showToast(`已添加 ${count} 个环节`);
}

// ── Panel image management ──
function addPanelImage(stepId) {
  _openImageFilePicker(stepId, 'panel');
}

function deletePanelImage(stepId, ii) {
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step || !step.images) return;
  step.images.splice(ii, 1);
  // Keep legacy imageUrl in sync
  step.imageUrl = step.images[0] || '';
  saveAllQdds();
  renderStepPanel();
  renderPreview();
}

function bindPanelImageDropZone(stepId) {
  const zone = document.querySelector(`#pp-img-list-${stepId} .pp-img-drop-zone`);
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('qt-img-drop-hover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('qt-img-drop-hover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('qt-img-drop-hover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      _inlineImgTargetId = stepId;
      _inlineImgTargetMode = 'panel';
      readInlineImageFile(file, stepId);
    }
  });
  // Ctrl+V paste on panel zone (focused)
  zone.addEventListener('focus', () => { _focusedImgZoneId = stepId; _focusedImgZoneMode = 'panel'; _inlineImgTargetMode = 'panel'; });
  zone.addEventListener('blur',  () => { setTimeout(() => { if (_focusedImgZoneId === stepId) { _focusedImgZoneId = null; _focusedImgZoneMode = null; } }, 500); });
  // Click also sets focus state (since onclick=addPanelImage steals focus before paste can fire)
  zone.addEventListener('mousedown', () => { _focusedImgZoneId = stepId; _focusedImgZoneMode = 'panel'; _inlineImgTargetMode = 'panel'; });
}

// ===== Trigger Inline Dropdown =====
let _triggerDropdownCleanup = null;

function toggleTriggerDropdown(event, stepId) {
  event.stopPropagation();
  // Close type dropdown too
  closeTypeDropdown();
  // Close existing trigger dropdown
  if (_triggerDropdownCleanup) { _triggerDropdownCleanup(); return; }

  const cell = event.currentTarget;
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step) return;

  const dropdown = document.createElement('div');
  dropdown.className = 'type-dropdown-menu';

  // "Clear" option first
  const allOptions = ['', ...TRIGGER_OPTIONS];
  allOptions.forEach(opt => {
    const item = document.createElement('div');
    item.className = 'type-dropdown-item' + ((step.trigger || '') === opt ? ' active' : '');
    item.textContent = opt || '—（清除）';
    item.addEventListener('click', e => {
      e.stopPropagation();
      step.trigger = opt;
      saveAllQdds();
      if (_triggerDropdownCleanup) _triggerDropdownCleanup();
      // Update cell text in-place without full re-render
      cell.childNodes[0].textContent = opt || '—';
    });
    dropdown.appendChild(item);
  });

  document.body.appendChild(dropdown);
  const rect = cell.getBoundingClientRect();
  dropdown.style.top  = (rect.bottom + 2) + 'px';
  dropdown.style.left = Math.min(rect.left, window.innerWidth - 180) + 'px';

  const onOutside = () => { if (_triggerDropdownCleanup) _triggerDropdownCleanup(); };
  setTimeout(() => document.addEventListener('click', onOutside, { once: true }), 0);
  _triggerDropdownCleanup = () => {
    document.removeEventListener('click', onOutside);
    if (dropdown.parentNode) dropdown.parentNode.removeChild(dropdown);
    _triggerDropdownCleanup = null;
  };
}

// ===== Inline Image Upload =====
let _inlineImgTargetId = null;
let _inlineImgTargetMode = 'preview'; // 'preview' | 'panel'

/** 每次调用都创建全新的 file input，彻底避免 value 清空无效、change 不触发的问题 */
function _openImageFilePicker(stepId, mode) {
  _inlineImgTargetId = stepId;
  _inlineImgTargetMode = mode;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.display = 'none';
  document.body.appendChild(input);

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (file) readInlineImageFile(file, _inlineImgTargetId);
    if (document.body.contains(input)) document.body.removeChild(input);
  });
  // 用户取消选择时（focus 回到 window）也要销毁 input
  window.addEventListener('focus', function onFocus() {
    setTimeout(() => {
      if (document.body.contains(input)) document.body.removeChild(input);
    }, 500);
    window.removeEventListener('focus', onFocus);
  }, { once: true });

  input.click();
}

function triggerInlineImageSelect(stepId) {
  _openImageFilePicker(stepId, 'preview');
}

function readInlineImageFile(file, stepId) {
  const reader = new FileReader();
  reader.onload = e => {
    const step = STATE.steps.find(s => s.id === stepId);
    if (!step) return;
    const dataUrl = e.target.result;

    if (_inlineImgTargetMode === 'panel') {
      // Add to images array
      if (!step.images) step.images = step.imageUrl ? [step.imageUrl] : [];
      step.images.push(dataUrl);
      step.imageUrl = step.images[0]; // keep legacy in sync
      saveAllQdds();
      renderStepPanel(); // refresh panel thumbnail list
      renderPreview();
      return;
    }

    // Inline mode: always append the new image (drag/paste into the image zone)
    if (!step.images) step.images = step.imageUrl ? [step.imageUrl] : [];
    step.images.push(dataUrl);
    step.imageUrl = step.images[0]; // keep legacy in sync
    saveAllQdds();
    if (STATE.layout === 'table') renderTableLayout();
    else renderTimelineLayout();
  };
  reader.readAsDataURL(file);
}

// Track which image zone is focused (for Ctrl+V)
let _focusedImgZoneId = null;
let _focusedImgZoneMode = null; // 'panel' | 'preview' | null

// ── Image zone drag-drop: delegated on document (survives re-renders) ──
let _imgDragTargetZone = null;

function _initImageZoneDelegation() {
  document.addEventListener('dragover', e => {
    const zone = e.target.closest('.qt-img-multi-wrap');
    if (!zone) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (_imgDragTargetZone !== zone) {
      if (_imgDragTargetZone) _imgDragTargetZone.classList.remove('qt-img-drop-hover');
      _imgDragTargetZone = zone;
      zone.classList.add('qt-img-drop-hover');
    }
  });

  document.addEventListener('dragleave', e => {
    const zone = e.target.closest('.qt-img-multi-wrap');
    if (!zone || zone !== _imgDragTargetZone) return;
    // Only clear if leaving the zone entirely (relatedTarget is outside)
    if (!zone.contains(e.relatedTarget)) {
      zone.classList.remove('qt-img-drop-hover');
      _imgDragTargetZone = null;
    }
  });

  document.addEventListener('drop', e => {
    const zone = e.target.closest('.qt-img-multi-wrap');
    if (!zone) return;
    e.preventDefault();
    zone.classList.remove('qt-img-drop-hover');
    _imgDragTargetZone = null;
    const stepId = zone.dataset.stepId;
    if (!stepId) return;
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      readInlineImageFile(file, stepId);
    }
  });
}

function bindInlineImageZones(container) {
  container.querySelectorAll('.qt-img-zone').forEach(zone => {
    const stepId = zone.dataset.stepId;
    if (!stepId) return;

    // Single click → focus (for Ctrl+V paste)
    zone.addEventListener('click', e => {
      if (e.target.classList.contains('qt-img-replace-btn')) return;
      zone.focus();
      _focusedImgZoneId = stepId;
      _focusedImgZoneMode = 'preview';
    });

    zone.addEventListener('focus', () => {
      _focusedImgZoneId = stepId;
      _focusedImgZoneMode = 'preview';
      zone.classList.add('qt-img-focused');
    });
    zone.addEventListener('blur', () => {
      setTimeout(() => {
        if (_focusedImgZoneId === stepId) { _focusedImgZoneId = null; _focusedImgZoneMode = null; }
        zone.classList.remove('qt-img-focused');
      }, 500);
    });

    // Double click → enlarge (only when image exists)
    zone.addEventListener('dblclick', e => {
      if (e.target.classList.contains('qt-img-replace-btn')) return;
      if (zone.classList.contains('qt-img-has-img')) {
        const imgEl = zone.querySelector('img');
        if (imgEl) openImagePreview(imgEl.src);
      }
    });
  });
}

// Global Ctrl+V handler for focused image zone
document.addEventListener('paste', e => {
  if (!_focusedImgZoneId) return;
  const items = e.clipboardData?.items;
  if (!items) return;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) {
        // Sync mode so readInlineImageFile knows where to save
        _inlineImgTargetMode = _focusedImgZoneMode || 'preview';
        readInlineImageFile(file, _focusedImgZoneId);
      }
      break;
    }
  }
});

// ===== Image Preview Modal =====
function openImagePreview(src) {
  // Remove existing
  const old = document.getElementById('img-preview-modal');
  if (old) old.remove();

  const modal = document.createElement('div');
  modal.id = 'img-preview-modal';
  modal.innerHTML = `
    <div class="img-preview-backdrop">
      <img class="img-preview-img" src="${esc(src)}" alt="预览">
      <div class="img-preview-hint">点击任意处关闭</div>
    </div>`;
  document.body.appendChild(modal);

  modal.addEventListener('click', () => modal.remove());
  // ESC to close
  const onKey = e => { if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
}

// ===== Task Type Inline Dropdown =====
let _typeDropdownCleanup = null;

function toggleTypeDropdown(event, stepId) {
  event.stopPropagation();
  // Close existing dropdown first
  closeTypeDropdown();

  const badge = event.currentTarget;
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step) return;

  // Build dropdown
  const dropdown = document.createElement('div');
  dropdown.className = 'type-dropdown-menu';

  TASK_TYPES.forEach(t => {
    const item = document.createElement('div');
    item.className = 'type-dropdown-item' + (step.taskType === t.value ? ' active' : '');
    const dot = t.color ? `<span class="type-dd-dot" style="background:${t.color}"></span>` : `<span class="type-dd-dot type-dd-dot-empty"></span>`;
    item.innerHTML = `${dot}<span>${t.label}</span>`;
    item.addEventListener('click', e => {
      e.stopPropagation();
      setStepTaskType(stepId, t.value);
      closeTypeDropdown();
    });
    dropdown.appendChild(item);
  });

  // Position relative to badge
  document.body.appendChild(dropdown);
  const rect = badge.getBoundingClientRect();
  dropdown.style.top  = (rect.bottom + 4) + 'px';
  dropdown.style.left = Math.min(rect.left, window.innerWidth - 160) + 'px';

  // Close on outside click
  const onOutside = () => closeTypeDropdown();
  setTimeout(() => document.addEventListener('click', onOutside, { once: true }), 0);
  _typeDropdownCleanup = () => {
    document.removeEventListener('click', onOutside);
    if (dropdown.parentNode) dropdown.parentNode.removeChild(dropdown);
    _typeDropdownCleanup = null;
  };
}

function closeTypeDropdown() {
  if (_typeDropdownCleanup) _typeDropdownCleanup();
}

function setStepTaskType(stepId, typeValue) {
  const step = STATE.steps.find(s => s.id === stepId);
  if (!step) return;
  step.taskType = typeValue;
  // Clear colorOverride so the type color takes effect
  step.colorOverride = null;
  saveAllQdds();
  // Re-render preview
  if (STATE.layout === 'table') renderTableLayout();
  else renderTimelineLayout();
  renderStepsList();
}

// ===== TIMELINE LAYOUT =====
function renderTimelineLayout() {
  const $previewCanvas = document.getElementById('preview-canvas');
  if (!$previewCanvas) return;
  const title = document.getElementById('questTitle')?.value || STATE.questTitle;
  const steps = STATE.steps;

  // Build grid column template:
  // Each step gets a fixed-width col (controlled by colWidth slider),
  // between steps there's a narrow arrow col
  const colW = STATE.colWidth + 'px';
  const gridCols = steps.map((_, i) =>
    i < steps.length - 1 ? `${colW} 36px` : colW
  ).join(' ');

  // ── Row 1: Title boxes + arrows ──
  const titleCells = steps.map((step, i) => {
    const color = getStepColor(step, i);
    const colIdx = i * 2 + 1; // 1-based grid column
    const typeInfo = step.taskType && TASK_TYPE_MAP[step.taskType] ? TASK_TYPE_MAP[step.taskType] : null;
    const badgeHtml = `<span class="qt-type-badge" data-step-id="${step.id}" onclick="toggleTypeDropdown(event,'${step.id}')" title="点击切换任务类型">${typeInfo ? typeInfo.label.split(' ')[0] : '＋类型'}</span>`;
    const arrowCell = i < steps.length - 1
      ? `<div class="tl-arrow-cell" style="grid-column:${colIdx + 1};grid-row:1">→</div>`
      : '';
    return `
      <div class="tl-title-cell" style="grid-column:${colIdx};grid-row:1">
        <div class="tl-title-box" style="background:${color}" onclick="openStepPanel('${step.id}')" title="点击打开属性面板" style="cursor:pointer">
          <div class="tl-title-inner">
            <span>${esc(step.name)}</span>
            ${badgeHtml}
          </div>
        </div>
      </div>
      ${arrowCell}
    `;
  }).join('');

  // ── Row 2: Images (multi-image support) ──
  const imgCells = steps.map((step, i) => {
    const colIdx = i * 2 + 1;
    const imgs = step.images && step.images.length > 0
      ? step.images
      : (step.imageUrl ? [step.imageUrl] : []);
    let imgHtml;
    if (imgs.length === 0) {
      imgHtml = `<div class="tl-image-placeholder" data-step-id="${step.id}">
          <span>📷 在属性面板添加配图</span>
        </div>`;
    } else if (imgs.length === 1) {
      imgHtml = `<img class="tl-image" src="${esc(imgs[0])}" alt="配图" loading="lazy"
          ondblclick="openImagePreview('${esc(imgs[0])}')" title="双击放大">`;
    } else {
      // Multiple: horizontal scroll strip
      const thumbs = imgs.map(url => `
        <img class="tl-image-thumb" src="${esc(url)}" alt="" loading="lazy"
          ondblclick="openImagePreview('${esc(url)}')" title="双击放大">`).join('');
      imgHtml = `<div class="tl-multi-img-strip">${thumbs}</div>`;
    }
    return `<div class="tl-img-cell" style="grid-column:${colIdx};grid-row:2">${imgHtml}</div>`;
  }).join('');

  // ── Row 3: Meta (trigger / location / characters / custom) ──
  const metaCells = steps.map((step, i) => {
    const colIdx = i * 2 + 1;
    const metaItems = [];
    if (step.trigger)    metaItems.push(`<div class="tl-meta-item"><strong>触发：</strong>${esc(step.trigger)}</div>`);
    if (step.location)   metaItems.push(`<div class="tl-meta-item"><strong>位置：</strong>${esc(step.location)}</div>`);
    if (step.characters) metaItems.push(`<div class="tl-meta-item"><strong>人物：</strong>${esc(step.characters)}</div>`);
    (step.customFields || []).forEach(f => {
      if (f.key) metaItems.push(`<div class="tl-meta-item"><strong>${esc(f.key)}：</strong>${esc(f.value)}</div>`);
    });
    return `<div class="tl-meta-cell" style="grid-column:${colIdx};grid-row:3"><div class="tl-meta">${metaItems.join('')}</div></div>`;
  }).join('');

  // ── Row 4: Description ──
  const descCells = steps.map((step, i) => {
    const colIdx = i * 2 + 1;
    return `<div class="tl-desc-cell" style="grid-column:${colIdx};grid-row:4">
      ${step.desc ? `<div class="tl-desc">${escWithBr(step.desc)}</div>` : ''}
    </div>`;
  }).join('');

  $previewCanvas.innerHTML = `
    <div class="timeline-wrap">
      <div class="timeline-title-bar">${esc(title)}</div>
      <div class="tl-grid" style="grid-template-columns:${gridCols}">
        ${titleCells}
        ${imgCells}
        ${metaCells}
        ${descCells}
      </div>
    </div>
  `;

  // Bind inline image drop zones
  bindInlineImageZones($previewCanvas);
}

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

// ===== Inject static modal shells =====
document.body.insertAdjacentHTML('beforeend', `
  <div id="step-editor" class="hidden"></div>
  <div id="import-modal" class="hidden"></div>
  <div id="toast"></div>
`);

// ===== Image Upload Helpers =====
function triggerImageFileSelect() {
  const fi = document.getElementById('ef-image-file');
  if (fi) fi.click();
}

function handleImageFileChange(input) {
  if (!input.files || !input.files[0]) return;
  fileToBase64(input.files[0], setImagePreview);
}

function fileToBase64(file, callback) {
  if (!file.type.startsWith('image/')) { showToast('❌ 请选择图片文件'); return; }
  const reader = new FileReader();
  reader.onload = e => callback(e.target.result);
  reader.readAsDataURL(file);
}

function setImagePreview(src) {
  const preview = document.getElementById('ef-image-preview');
  const urlInput = document.getElementById('ef-image');
  const clearBtn = document.getElementById('ef-image-clear');
  if (!preview) return;
  preview.innerHTML = `<img src="${src}" alt="预览">`;
  if (urlInput) urlInput.value = src;
  if (clearBtn) clearBtn.style.display = '';
}

function clearImageField() {
  const preview = document.getElementById('ef-image-preview');
  const urlInput = document.getElementById('ef-image');
  const clearBtn = document.getElementById('ef-image-clear');
  if (preview) preview.innerHTML = '<span class="image-upload-hint">📷 拖入图片 / Ctrl+V 粘贴 / 点击选择</span>';
  if (urlInput) urlInput.value = '';
  if (clearBtn) clearBtn.style.display = 'none';
  const fi = document.getElementById('ef-image-file');
  if (fi) fi.value = '';
}

function handleImageUrlInput(val) {
  const preview = document.getElementById('ef-image-preview');
  const clearBtn = document.getElementById('ef-image-clear');
  if (!preview) return;
  if (val.trim()) {
    preview.innerHTML = `<img src="${esc(val.trim())}" alt="预览" onerror="this.parentElement.innerHTML='<span class=\\'image-upload-hint\\'>图片加载失败，请检查地址</span>'">`;
    if (clearBtn) clearBtn.style.display = '';
  } else {
    preview.innerHTML = '<span class="image-upload-hint">📷 拖入图片 / Ctrl+V 粘贴 / 点击选择</span>';
    if (clearBtn) clearBtn.style.display = 'none';
  }
}

function bindImageDropZone() {
  const zone = document.getElementById('ef-image-drop-zone');
  if (!zone) return;

  // Drag & Drop
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) fileToBase64(file, setImagePreview);
  });

  // Click on preview to pick file
  const preview = zone.querySelector('#ef-image-preview');
  if (preview) {
    preview.addEventListener('click', () => {
      if (!preview.querySelector('img')) triggerImageFileSelect();
    });
  }
}

function bindImagePaste() {
  document.addEventListener('paste', e => {
    // Only when editor is open
    const editor = document.getElementById('step-editor');
    if (!editor || editor.classList.contains('hidden')) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) fileToBase64(file, setImagePreview);
        break;
      }
    }
  });
}

// Bind paste once globally
bindImagePaste();

// ===== Start =====
init();
