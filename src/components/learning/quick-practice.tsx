'use client';

import Link from 'next/link';
import { useLT } from '@/lib/i18n/locale';
import { useLanguageStore } from '@/stores/language-store';

export function QuickPractice() {
  const t = useLT();
  return (
    <details className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <summary className="min-h-11 cursor-pointer content-center text-sm font-medium text-indigo-700">
        {t('Practice one skill', '只练一个专项', 'Luyện một kỹ năng')}
      </summary>
      <p className="mb-3 text-sm text-slate-500">
        {t(
          'Choose material and practice independently, without completing a whole lesson.',
          '不必完成整课，选择材料后自由练习。',
          'Không cần xong cả bài — chọn tài liệu rồi tự luyện.',
        )}
      </p>
      <nav aria-label={t('Quick practice', '快捷练习', 'Luyện nhanh')} className="flex flex-wrap gap-2">
        {[
          ['/listen', 'Listening', '听力练习', 'Luyện nghe'],
          ['/read', 'Read aloud', '跟读练习', 'Đọc to'],
          ['/write', 'Spelling practice', '拼写练习', 'Luyện chính tả'],
          ['/speak', 'AI conversation', 'AI 对话', 'Trò chuyện AI'],
          ['/pronunciation', 'Pronunciation', '发音训练', 'Luyện phát âm'],
        ].map(([href, en, cn, vi]) => (
          <Link
            key={href}
            href={href}
            className="inline-flex min-h-11 items-center rounded-lg bg-indigo-50 px-3 text-sm text-indigo-700 hover:bg-indigo-100"
          >
            {t(en, cn, vi)}
          </Link>
        ))}
      </nav>
    </details>
  );
}
