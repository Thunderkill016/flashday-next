'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLT } from '@/lib/i18n/locale';
import { learningSection, withinRoute } from '@/lib/learning-navigation';
import { useLanguageStore } from '@/stores/language-store';

const sections = {
  notes: {
    en: 'My notes',
    zh: '我的笔记',
    vi: 'Ghi chú của tôi',
    description: [
      'Keep words, useful expressions and their context together.',
      '集中整理单词、实用表达和出处，保留原有笔记。',
      'Giữ từ, cụm từ hay và ngữ cảnh của chúng cùng một chỗ.',
    ],
    links: [
      ['/favorites', 'Saved notes', '收藏笔记', 'Ghi chú đã lưu'],
      ['/journal', 'Useful expressions', '实用表达', 'Cụm từ hay'],
    ],
  },
  review: {
    en: 'Review center',
    zh: '复习中心',
    vi: 'Trung tâm ôn tập',
    description: [
      'Revisit lessons, recall saved notes and work on weak spots.',
      '复习课程、回忆收藏内容，针对薄弱项继续练习。',
      'Ôn lại bài học, nhớ lại ghi chú đã lưu và luyện các điểm yếu.',
    ],
    links: [
      ['/review', 'Overview', '复习概览', 'Tổng quan'],
      ['/review/today', 'Lesson review', '课程复习', 'Ôn bài học'],
      ['/library/vocabulary', 'Vocabulary review', '单词复习', 'Ôn từ vựng'],
      ['/favorites/review', 'Notes review', '笔记复习', 'Ôn ghi chú'],
      ['/weak-spots', 'Weak spots', '薄弱项', 'Điểm yếu'],
    ],
  },
  materials: {
    en: 'Learning materials',
    zh: '学习资料',
    vi: 'Tài liệu học',
    description: [
      'Manage originals here. Follow lessons and progress in My courses.',
      '在这里管理原始材料，在“我的课程”中按课学习。',
      'Quản lý tài liệu gốc tại đây. Theo dõi bài học và tiến độ trong Khoá học của tôi.',
    ],
    links: [
      ['/library', 'My materials', '我的资料', 'Tài liệu của tôi'],
      ['/library/wordbooks', 'Word books', '词书', 'Sổ từ'],
      ['/library/import', 'Import material', '导入材料', 'Nhập tài liệu'],
    ],
  },
} as const;

export function LearningSectionNav() {
  const pathname = usePathname();
  const t = useLT();
  const section = learningSection(pathname);
  if (section !== 'notes' && section !== 'review') return null;
  const config = sections[section];
  const Heading = pathname === '/review' ? 'h1' : 'p';
  // The most specific matching link wins: /review must not steal /review/today.
  const selected = pathname.startsWith('/library/vocabulary')
    ? '/library/wordbooks'
    : [...config.links].sort((a, b) => b[0].length - a[0].length).find(([href]) => withinRoute(pathname, href))?.[0];
  return (
    <section
      className="mx-auto mb-6 max-w-6xl border-b border-slate-200 pb-4"
      aria-label={t(config.en, config.zh, config.vi)}
    >
      <Heading className="text-xl font-semibold text-slate-900">{t(config.en, config.zh, config.vi)}</Heading>
      <p className="mt-1 text-sm text-slate-500">
        {t(config.description[0], config.description[1], config.description[2])}
      </p>
      <nav aria-label={t('Section navigation', '分区导航', 'Điều hướng mục')} className="mt-3 flex flex-wrap gap-2">
        {config.links.map(([href, en, cn, vi]) => (
          <Link
            key={href}
            href={href}
            aria-current={selected === href ? 'page' : undefined}
            className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-indigo-600 ${selected === href ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-indigo-50'}`}
          >
            {t(en, cn, vi)}
          </Link>
        ))}
      </nav>
    </section>
  );
}
