export type LearningSection =
  | 'today'
  | 'courses'
  | 'materials'
  | 'resources'
  | 'review'
  | 'notes'
  | 'conversation'
  | 'pronunciation'
  | 'settings';

export const PRIMARY_LEARNING_LINKS = [
  { section: 'today', href: '/dashboard', en: 'Today', vi: 'Hôm nay', zh: '今日学习' },
  { section: 'courses', href: '/learn', en: 'My courses', vi: 'Khoá học của tôi', zh: '我的课程' },
  { section: 'materials', href: '/library', en: 'Learning materials', vi: 'Tài liệu học', zh: '学习资料' },
  { section: 'resources', href: '/resources', en: 'Community resources', vi: 'Tài nguyên cộng đồng', zh: '社区资源' },
  { section: 'review', href: '/review', en: 'Review center', vi: 'Trung tâm ôn tập', zh: '复习中心' },
  { section: 'notes', href: '/favorites', en: 'My notes', vi: 'Ghi chú của tôi', zh: '我的笔记' },
  { section: 'conversation', href: '/speak', en: 'AI conversation', vi: 'Trò chuyện AI', zh: 'AI 对话' },
  { section: 'pronunciation', href: '/pronunciation', en: 'Pronunciation', vi: 'Luyện phát âm', zh: '发音训练' },
] as const;

export function withinRoute(path: string, root: string): boolean {
  return path === root || path.startsWith(`${root}/`);
}

export function learningSection(path: string): LearningSection | null {
  if (['/review', '/favorites/review', '/weak-spots'].some((root) => withinRoute(path, root))) return 'review';
  if (['/favorites', '/journal'].some((root) => withinRoute(path, root))) return 'notes';
  if (['/learn', '/listen', '/read', '/write'].some((root) => withinRoute(path, root))) return 'courses';
  if (withinRoute(path, '/settings')) return 'settings';
  return PRIMARY_LEARNING_LINKS.find((link) => withinRoute(path, link.href))?.section ?? null;
}
