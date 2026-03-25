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
