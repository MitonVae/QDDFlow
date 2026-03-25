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
              <label class="ai-validate-btn" style="cursor:pointer;" title="从 AI 导出下载的 .json 文件导入（含图片）">
                📂 从文件导入
                <input type="file" accept=".json" style="display:none" onchange="loadAiImportFile(this)">
              </label>
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
    const currentQdd = getCurrentQdd();
    if (!currentQdd) { setAiFeedback('❌ 当前没有打开的 QDD，请先选择或创建一个', true); return; }
    const srcSteps = (qdds[0].steps || []);
    let matched = 0, added = 0;
    srcSteps.forEach(incoming => {
      let target = null;
      const idxStr = incoming.index != null ? String(incoming.index).trim() : '';
      if (idxStr) target = currentQdd.steps.find(s => String(s.index || '').trim() === idxStr);
      if (!target && incoming.name) target = currentQdd.steps.find(s => s.name === incoming.name);
      if (target) { mergeAiStep(target, incoming); matched++; }
      else { currentQdd.steps.push(normalizeAiStep(incoming)); added++; }
    });
    syncStateFromQdd(currentQdd);
    const msg = `✅ 已更新 ${matched} 个环节${added > 0 ? `，追加 ${added} 个新环节` : ''}`;
    setAiFeedback(msg, false);
    _migrateImagesAndRefresh(msg, false);

  } else if (mode === 'add') {
    const currentQdd = getCurrentQdd();
    if (!currentQdd) { setAiFeedback('❌ 当前没有打开的 QDD，请先选择或创建一个', true); return; }
    const newSteps = (qdds[0].steps || []).map(s => normalizeAiStep(s));
    currentQdd.steps.push(...newSteps);
    syncStateFromQdd(currentQdd);
    const msg = `✅ 已追加 ${newSteps.length} 个环节到当前 QDD`;
    setAiFeedback(msg, false);
    _migrateImagesAndRefresh(msg, false);

  } else {
    // new QDD 模式：先把数据写进 STORE，再 migrate，migrate 完成后再跳首页
    for (const raw of qdds) {
      STORE.qdds.push({ id: genId(), title: raw.title || '从AI导入', steps: (raw.steps || []).map(s => normalizeAiStep(s)) });
    }
    const msg = `✅ 已导入 ${qdds.length} 个 QDD`;
    setAiFeedback(msg, false);
    _migrateImagesAndRefresh(msg, true);  // migrate 完成后才跳首页
  }
}

async function _migrateImagesAndRefresh(successMsg, goHome = false) {
  showToast('⏳ 正在处理图片...');
  try {
    // 先把所有 base64 存入 IndexedDB，step.imageUrl 变为 idb: key
    await migrateAllImagesToDb();
    // 再保存到 localStorage（此时只含 idb: key，体积极小）
    saveAllQdds();
    // 预热缓存，确保渲染时能立即显示
    await _preloadStepImages();
  } catch (e) {
    console.warn('[_migrateImagesAndRefresh]', e);
  }
  if (goHome) {
    closeAiImportPanel();
    showHomePage();
  } else {
    renderAll();
  }
  showToast(successMsg);
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
    const msg = `✅ 已更新 ${matched} 个环节${added > 0 ? `，追加 ${added} 个新环节` : ''}`;
    setAiFeedback(msg, false);
    _migrateImagesAndRefresh(msg);

  } else if (mode === 'add') {
    const currentQdd = getCurrentQdd();
    if (!currentQdd) { setAiFeedback('❌ 当前没有打开的 QDD，请先选择或创建一个', true); return; }
    const srcQdd = qdds[0];
    const newSteps = (srcQdd.steps || []).map(s => normalizeAiStep(s));
    currentQdd.steps.push(...newSteps);
    syncStateFromQdd(currentQdd);
    const msg = `✅ 已追加 ${newSteps.length} 个环节到当前 QDD`;
    setAiFeedback(msg, false);
    _migrateImagesAndRefresh(msg);

  } else {
    // new QDD mode
    for (const raw of qdds) {
      const newQdd = {
        id: genId(),
        title: raw.title || '从AI导入',
        steps: (raw.steps || []).map(s => normalizeAiStep(s)),
      };
      STORE.qdds.push(newQdd);
    }
    const msg = `✅ 已导入 ${qdds.length} 个 QDD`;
    setAiFeedback(msg, false);
    _migrateImagesAndRefresh(msg, true);
  }
}

/**
 * 导入完成后统一收尾：
 * 1. 把所有 base64 imageUrl 迁移进 IndexedDB（这样 localStorage 不会超限）
 * 2. saveAllQdds()（此时 localStorage 只存 idb: key，很小）
 * 3. 预热图片缓存，刷新界面
 */
async function _migrateImagesAndRefresh(successMsg, goHome = false) {
  showToast('⏳ 正在处理图片...');
  try {
    await migrateAllImagesToDb(); // 把所有 base64 迁移进 IndexedDB
    saveAllQdds();                // 重新保存（现在只含 idb: key，体积小）
    await _preloadStepImages();   // 预热缓存
  } catch (e) {
    console.warn('[_migrateImagesAndRefresh]', e);
  }
  if (goHome) {
    closeAiImportPanel();
    showHomePage();
  } else {
    renderAll();
  }
  showToast(successMsg);
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

// ===== AI 导出面板 =====

async function openAiExportPanel() {
  const qdd = getCurrentQdd();
  if (!qdd) { showToast('❌ 没有打开的 QDD'); return; }

  // AI 用的纯文字 JSON（不含图片）
  const textObj = {
    title: qdd.title,
    steps: (qdd.steps || []).map((s, i) => ({
      name:         s.name         || `环节${i}`,
      taskType:     s.taskType     || '',
      trigger:      s.trigger      || '',
      location:     s.location     || '',
      characters:   s.characters   || '',
      desc:         s.desc         || '',
      customFields: (s.customFields || []).filter(f => f.key),
    })),
  };
  const jsonText = JSON.stringify(textObj, null, 2);

  let overlay = document.getElementById('ai-export-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'ai-export-overlay';
    overlay.className = 'ai-import-overlay';
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) closeAiExportPanel(); });
  }

  overlay.innerHTML = `
    <div class="ai-import-panel" style="max-width:700px;">
      <div class="ai-import-header">
        <div class="ai-import-title">
          <span>🤖 AI 导出</span>
          <small>当前 QDD：${escHtml(qdd.title)}（${qdd.steps.length} 个环节）</small>
        </div>
        <button class="ai-import-close" onclick="closeAiExportPanel()">×</button>
      </div>
      <div class="ai-import-body" style="flex-direction:column;gap:14px;">
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="ai-do-import-btn" style="flex:1;min-width:160px;" onclick="copyAiExportJson()">
            📋 复制文字 JSON（发给 AI）
          </button>
          <button class="ai-do-import-btn" style="flex:1;min-width:160px;background:linear-gradient(135deg,#059669,#0d9488);" onclick="downloadAiExportJson()">
            💾 下载完整备份（含图片）
          </button>
        </div>
        <div style="font-size:12px;color:var(--text-muted);line-height:1.6;">
          · <strong>复制文字 JSON</strong>：不含图片，直接发给 AI 让它续写/修改，再用「AI 导入」粘贴回来。<br>
          · <strong>下载完整备份</strong>：含图片的 .json 文件，可在「AI 导入 → 从文件导入」读取还原。
        </div>
        <pre class="ai-prompt-pre" id="ai-export-json-content" style="max-height:320px;">${escHtml(jsonText)}</pre>
      </div>
    </div>
  `;
  overlay.classList.add('visible');
}

function closeAiExportPanel() {
  const overlay = document.getElementById('ai-export-overlay');
  if (overlay) overlay.classList.remove('visible');
}

function copyAiExportJson() {
  const pre = document.getElementById('ai-export-json-content');
  if (!pre) return;
  navigator.clipboard.writeText(pre.textContent).then(() => {
    showToast('✅ 已复制，可直接发给 AI');
  }).catch(() => {
    const el = document.createElement('textarea');
    el.value = pre.textContent;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('✅ 已复制');
  });
}

async function downloadAiExportJson() {
  const qdd = getCurrentQdd();
  if (!qdd) return;

  showToast('⏳ 正在处理图片...');

  // 深拷贝并解析所有 idb: 图片为真实 base64
  const full = JSON.parse(JSON.stringify(qdd));
  for (const s of (full.steps || [])) {
    const resolved = getResolvedImageUrl(s.imageUrl || '');
    s.imageUrl = resolved;
    s.images   = resolved ? [resolved] : [];
  }

  const json = JSON.stringify(full, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${(qdd.title || 'QDD').replace(/[/\\:*?"<>|]/g, '_')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ 已下载');
}

// 从文件读取 JSON 填入 AI 导入的 textarea（含图片的完整备份也支持）
function loadAiImportFile(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const textarea = document.getElementById('ai-json-input');
    if (textarea) {
      textarea.value = e.target.result;
      showToast('✅ 文件已加载，点击「导入」继续');
    }
  };
  reader.readAsText(file);
  input.value = '';
}