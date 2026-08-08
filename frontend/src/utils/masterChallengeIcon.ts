/**
 * 大师挑战模板 icon 字段存的是 lucide 风格英文 key（如 gift/cat），
 * 前端展示时映射为 emoji，避免直接把英文 key 渲染到页面上。
 */
const ICON_EMOJI: Record<string, string> = {
  plane: '✈️',
  clipboard: '📋',
  utensils: '🍽️',
  heart: '❤️',
  'book-open': '📖',
  activity: '🏃',
  film: '🎬',
  'pie-chart': '📊',
  book: '📚',
  drama: '🎭',
  home: '🏠',
  leaf: '🍃',
  gift: '🎁',
  music: '🎵',
  camera: '📷',
  flask: '🧪',
  cat: '🐱',
  flower: '🌸',
  users: '👥',
  recycle: '♻️',
  'shopping-bag': '🛍️',
  'piggy-bank': '🐷',
  target: '🎯',
  'shopping-cart': '🛒',
  store: '🏪',
  'trending-up': '📈',
  'bar-chart': '📉',
};

const DEFAULT_ICON = '🎯';

/** 将模板 icon key / emoji 转为可展示的 emoji */
export function masterChallengeIcon(icon?: string | null): string {
  if (!icon) return DEFAULT_ICON;
  const key = icon.trim();
  if (!key) return DEFAULT_ICON;
  // 已是 emoji / 非 ascii 时直接展示
  if (/[^\x00-\x7F]/.test(key)) return key;
  return ICON_EMOJI[key.toLowerCase()] || DEFAULT_ICON;
}
