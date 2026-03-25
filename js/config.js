// ===== Task Type Config =====
const TASK_TYPES = [
  { value: '',      label: '—（未设定）', color: null },
  { value: 'PUZ',   label: 'PUZ 玩法',   color: '#7c6af7' }, // 紫
  { value: 'BAT',   label: 'BAT 战斗',   color: '#06d6a0' }, // 绿
  { value: 'NAV',   label: 'NAV 跑图',   color: '#ffd166' }, // 黄
  { value: 'STORY', label: '剧情',        color: '#8e9aaf' }, // 灰
];
const TASK_TYPE_MAP = Object.fromEntries(TASK_TYPES.filter(t => t.value).map(t => [t.value, t]));

// 动态合并内置 + 自定义任务类型（STORE 初始化后可用）
function getTaskTypes() {
  return [...TASK_TYPES, ...(STORE.customTaskTypes || [])];
}

// 动态合并内置 + 自定义触发方式
function getTriggerOptions() {
  return [...TRIGGER_OPTIONS_BASE, ...(STORE.customTriggers || [])];
}

// 查找任意任务类型（内置 + 自定义）
function findTaskType(value) {
  if (!value) return null;
  return TASK_TYPE_MAP[value]
    || (STORE.customTaskTypes || []).find(t => t.value === value)
    || null;
}

const TRIGGER_OPTIONS_BASE = [
  'Room触发',
  '接续自动触发',
  '剧情触发',
  '玩家选择',
  '接续',
];

// 向后兼容：TRIGGER_OPTIONS 本身仍可作为基础列表使用
const TRIGGER_OPTIONS = TRIGGER_OPTIONS_BASE;
