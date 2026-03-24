// ===== Task Type Config =====
const TASK_TYPES = [
  { value: '',      label: '鈥旓紙鏈瀹氾級', color: null },
  { value: 'PUZ',   label: 'PUZ 鐜╂硶',   color: '#7c6af7' }, // 绱?  { value: 'BAT',   label: 'BAT 鎴樻枟',   color: '#06d6a0' }, // 缁?  { value: 'NAV',   label: 'NAV 璺戝浘',   color: '#ffd166' }, // 榛?  { value: 'STORY', label: '鍓ф儏',        color: '#8e9aaf' }, // 鐏?];
const TASK_TYPE_MAP = Object.fromEntries(TASK_TYPES.filter(t => t.value).map(t => [t.value, t]));

const TRIGGER_OPTIONS = [
  'Room瑙﹀彂',
  '鎺ョ画鑷姩瑙﹀彂',
  '鍓ф儏瑙﹀彂',
  '鐜╁閫夋嫨',
  '鎺ョ画',
];

// ===== Persistence =====
const STORAGE_KEYS = {
  layout:   'qdd_layout',
  theme:    'qdd_theme',
