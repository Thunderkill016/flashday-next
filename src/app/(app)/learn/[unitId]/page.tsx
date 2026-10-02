'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Headphones, Mic, PenTool } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LessonMedia } from '@/components/learning/lesson-media';
import { LessonWorkshop } from '@/components/learning/lesson-workshop';
import { VocabularyWorkspace } from '@/components/learning/vocabulary-workspace';
import { SingleItemPractice } from '@/components/shared/word-book-practice';
import { useLearningWorkspace } from '@/hooks/use-learning-workspace';
import { db } from '@/lib/db';
import { lessonProgress } from '@/lib/learning-units';
import { deriveTextCycle } from '@/lib/text-learning-cycle';
import { useLanguageStore } from '@/stores/language-store';

const icons = { listen: Headphones, read: BookOpen, speak: Mic, write: PenTool };
export default function CoursePage() {
  const params = useParams<{ unitId: string }>();
  const query = useSearchParams();
  const { data, error, retry } = useLearningWorkspace();
  const attempts = useLiveQuery(() => db.learningAttempts.toArray(), [data?.database.name]) ?? [];
  const [selected, setSelected] = useState<string | null>(null);
  const [workshop, setWorkshop] = useState(true);
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState('');
  const [size, setSize] = useState(350);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const language = useLanguageStore((s) => s.interfaceLanguage);
  const t = (en: string, cn: string, vi: string) => (language === 'zh' ? cn : language === 'vi' ? vi : en);
  const labels = {
    listen: t('Listen', '听', 'Nghe'),
    read: t('Read aloud', '朗读', 'Đọc to'),
    speak: t('Speak', '说', 'Nói'),
    write: t('Type', '写', 'Gõ'),
  };
  const unit = data?.units.find((u) => u.id === params.unitId || encodeURIComponent(u.id) === params.unitId);
  const lessons = data?.lessons.filter((l) => l.unitId === unit?.id).sort((a, b) => a.order - b.order) ?? [];
  const lesson =
    lessons.find((l) => l.id === (selected ?? query.get('lesson'))) ??
    lessons.find(
      (l) => !deriveTextCycle(l.id, l.exercises.map((item) => item.text).join('\n\n'), attempts, Date.now()).completed,
    ) ??
    lessons[0];
  const progress = lesson ? lessonProgress(lesson, data?.sessions ?? []) : undefined;
  const index = stepIndex ?? Math.max(0, progress?.steps.findIndex((s) => !s.completed) ?? 0);
  const step = progress?.steps[Math.min(index, progress.total - 1)];
  const completed = lessons.filter(
    (l) => deriveTextCycle(l.id, l.exercises.map((item) => item.text).join('\n\n'), attempts, Date.now()).completed,
  ).length;
  const drillsCompleted = lessons.filter((l) => !lessonProgress(l, data?.sessions ?? []).next).length;
  useEffect(() => {
    if (lesson) {
      if (selected === null) setSelected(lesson.id);
      if (stepIndex === null) setStepIndex(index);
    }
  }, [lesson, index, stepIndex, selected]);
  const openLesson = (id: string) => {
    setSelected(id);
    setStepIndex(null);
  };
  const save = async () => {
    if (!unit || !lesson) return;
    setSaving(true);
    setSaveError('');
    try {
      await db.transaction('rw', db.contents, async () => {
        for (const sourceId of unit.sourceIds) {
          const source = await db.contents.get(sourceId);
          if (!source) continue;
          await db.contents.update(source.id, {
            metadata: {
              ...source.metadata,
              courseWordsPerLesson: size,
              ...(sourceId === unit.sourceIds[0]
                ? { lessonTitles: { ...source.metadata?.lessonTitles, [lesson.id]: title.trim() || lesson.title } }
                : {}),
            },
            updatedAt: Date.now(),
          });
        }
      });
      setEdit(false);
      setStepIndex(null);
    } catch {
      setSaveError(t('Could not save changes. Try again.', '保存失败，请重试。', 'Không lưu được thay đổi. Thử lại.'));
    } finally {
      setSaving(false);
    }
  };
  if (error)
    return (
      <div role="alert">
        {error}
        <button onClick={retry} type="button">
          {t('Retry', '重试', 'Thử lại')}
        </button>
      </div>
    );
  if (!data) return <p role="status">{t('Preparing your course…', '正在准备课程…', 'Đang chuẩn bị khoá học…')}</p>;
  if (!unit || !lesson || !progress || !step)
    return (
      <div className="space-y-4">
        <p>
          {t(
            'This course is unavailable. Its sources may have been moved to the recycle bin.',
            '课程暂不可用，原始材料可能已移至回收站。',
            'Khoá học này hiện không mở được. Nguồn của nó có thể đã bị chuyển vào thùng rác.',
          )}
        </p>
        <Link href="/learn" className="text-indigo-600">
          {t('Back to courses', '返回课程', 'Về khoá học')}
        </Link>
      </div>
    );
  const Icon = icons[step.module];
  if (unit.materialType === 'wordbook')
    return (
      <main className="mx-auto max-w-5xl space-y-5 pb-24">
        <Link href="/library" className="inline-flex min-h-11 items-center text-indigo-600">
          {t('Back to learning materials', '返回学习材料', 'Về tài liệu học')}
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">{unit.title}</h1>
        <VocabularyWorkspace
          key={unit.id}
          data={data}
          scopeIds={unit.sourceIds}
          baseHref={`/learn/${encodeURIComponent(unit.id)}`}
        />
      </main>
    );
  return (
    <main className="mx-auto max-w-7xl space-y-6 pb-28">
      <header>
        <Link href="/library" className="inline-flex min-h-11 items-center gap-2 text-sm text-indigo-600">
          <ArrowLeft className="h-4 w-4" />
          {t('Learning materials', '学习材料', 'Tài liệu học')}
        </Link>
        <h1 className="break-words font-[var(--font-poppins)] text-3xl font-semibold tracking-tight text-indigo-950">
          {unit.title}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {t(
            `${completed} / ${lessons.length} lessons complete · Your original material is preserved`,
            `${completed} / ${lessons.length} 课已完成 · 原始材料完整保留`,
            `Đã xong ${completed} / ${lessons.length} bài · Tài liệu gốc của bạn được giữ nguyên`,
          )}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {t(
            `${drillsCompleted} drill lessons complete · separate from comprehension and writing`,
            `${drillsCompleted} 课专项练习完成 · 与理解表达闭环分开统计`,
            `Đã xong ${drillsCompleted} bài luyện chuyên sâu · tính riêng với phần hiểu và viết`,
          )}
        </p>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-2xl bg-white p-4 shadow-sm">
          <button
            type="button"
            className="min-h-11 w-full text-left text-sm font-semibold text-indigo-900 focus-visible:ring-2 focus-visible:ring-indigo-500 lg:hidden"
            aria-expanded={outlineOpen}
            aria-controls="course-outline"
            onClick={() => setOutlineOpen((value) => !value)}
          >
            {t('Course outline', '课程目录', 'Đề cương khoá học')} · {lessons.length} {t('lessons', '课', 'bài học')}
          </button>
          <div id="course-outline" className={outlineOpen ? 'block' : 'hidden lg:block'}>
            <h2 className="px-2 py-3 text-sm font-semibold text-slate-900">
              {t('Course outline', '课程目录', 'Đề cương khoá học')}
            </h2>
            <ol className="max-h-72 space-y-1 overflow-auto lg:max-h-[65vh]">
              {lessons.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => openLesson(l.id)}
                    aria-current={l.id === lesson.id ? 'step' : undefined}
                    className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm ${l.id === lesson.id ? 'bg-indigo-50 font-semibold text-indigo-800' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <span className="shrink-0 tabular-nums">
                      {deriveTextCycle(l.id, l.exercises.map((item) => item.text).join('\n\n'), attempts, Date.now())
                        .completed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        String(l.order + 1).padStart(2, '0')
                      )}
                    </span>
                    <span className="min-w-0 break-words">{l.title}</span>
                  </button>
                </li>
              ))}
            </ol>
            <Link
              href={`/read/${encodeURIComponent(unit.sourceIds[0])}`}
              className="mt-4 block px-2 py-3 text-xs text-indigo-600"
            >
              {t('Open original material', '查看原始材料', 'Mở tài liệu gốc')}
            </Link>
          </div>
        </aside>
        <section className="min-w-0 space-y-5">
          {lesson.exercises[0].metadata?.scenario && (
            <section className="space-y-2 rounded-xl bg-indigo-50 p-4 text-sm">
              <h2 className="font-semibold">{t('Scenario task', '场景任务', 'Nhiệm vụ tình huống')}</h2>
              <p>{lesson.exercises[0].metadata.scenario.situation}</p>
              <p>
                {t('Your role: ', '你的角色：', 'Vai của bạn: ')}
                {lesson.exercises[0].metadata.scenario.role}
              </p>
              <p>
                {t('Goal: ', '目标：', 'Mục tiêu: ')}
                {lesson.exercises[0].metadata.scenario.goal}
              </p>
            </section>
          )}
          {(unit.materialType === 'video' || lesson.exercises[0].metadata?.audioUrl) && (
            <LessonMedia key={lesson.id} item={lesson.exercises[0]} />
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={workshop}
              onClick={() => setWorkshop(true)}
              className={`min-h-11 rounded-xl px-4 text-sm active:scale-95 ${workshop ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'}`}
            >
              {t('Text learning cycle', '文本学习闭环', 'Chu trình học văn bản')}
            </button>
            <button
              type="button"
              aria-pressed={!workshop}
              onClick={() => setWorkshop(false)}
              className={`min-h-11 rounded-xl px-4 text-sm active:scale-95 ${!workshop ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700'}`}
            >
              {t('Listen · Read aloud · Speak · Type', '听 · 朗读 · 说 · 打字', 'Nghe · Đọc to · Nói · Gõ')}
            </button>
          </div>
          {workshop ? (
            <LessonWorkshop
              key={`${lesson.id}:${query.get('weakSpot') ?? ''}`}
              lesson={lesson}
              sourceWeakSpotId={query.get('weakSpot') ?? undefined}
            />
          ) : (
            <>
              <div className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
                      {t(`Lesson ${lesson.order + 1}`, `第 ${lesson.order + 1} 课`, `Bài ${lesson.order + 1}`)}
                    </p>
                    <h2 className="mt-2 break-words text-xl font-semibold text-slate-900">{lesson.title}</h2>
                  </div>
                  <button
                    type="button"
                    className="min-h-11 px-3 text-sm text-indigo-600"
                    onClick={() => {
                      setTitle(lesson.title);
                      setSize(
                        data.contents.find((c) => c.id === unit.sourceIds[0])?.metadata?.courseWordsPerLesson ?? 350,
                      );
                      setEdit((v) => !v);
                    }}
                  >
                    {t('Adjust lesson', '调整课程', 'Điều chỉnh bài học')}
                  </button>
                </div>
                {edit && (
                  <div className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4">
                    <label className="block text-sm">
                      {t('Lesson title', '本课标题', 'Tiêu đề bài học')}
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3"
                      />
                    </label>
                    <label className="block text-sm">
                      {t(
                        'Text lesson size (course-wide)',
                        '每课文字量（应用于本课程）',
                        'Độ dài bài học chữ (toàn khoá)',
                      )}
                      <select
                        value={size}
                        onChange={(e) => setSize(Number(e.target.value))}
                        className="ml-3 min-h-11 rounded-lg border border-slate-200 bg-white px-3"
                      >
                        <option value={150}>150 {t('words', '词', 'từ')}</option>
                        <option value={350}>350 {t('words', '词', 'từ')}</option>
                        <option value={600}>600 {t('words', '词', 'từ')}</option>
                      </select>
                    </label>
                    <p className="text-xs text-slate-600">
                      {t(
                        'Re-splitting creates automatically titled exercises; you can rename them afterward. Previous practice remains in history. Timed media keeps 5-minute boundaries and vocabulary keeps 20 items.',
                        '重新切分会生成自动命名的新练习，之后可再修改标题；旧练习记录仍保留。字幕按约 5 分钟切分，词表每课 20 项。',
                        'Chia lại sẽ tạo bài tập tự đặt tên, có thể đổi tên sau. Lịch sử luyện trước vẫn giữ. Media có mốc thời gian chia khoảng 5 phút, từ vựng giữ 20 mục.',
                      )}
                    </p>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void save()}
                      className="min-h-11 rounded-xl bg-indigo-600 px-4 text-white disabled:opacity-50"
                    >
                      {saving
                        ? t('Saving…', '保存中…', 'Đang lưu…')
                        : t('Save adjustments', '保存调整', 'Lưu điều chỉnh')}
                    </button>
                    {saveError && <p role="alert">{saveError}</p>}
                  </div>
                )}
                <div className="mt-5 grid grid-cols-4 gap-2">
                  {lesson.modules.map((module) => {
                    const ModuleIcon = icons[module];
                    const moduleSteps = progress.steps.filter((s) => s.module === module);
                    const done = moduleSteps.every((s) => s.completed);
                    return (
                      <button
                        type="button"
                        key={module}
                        onClick={() => setStepIndex(progress.steps.findIndex((s) => s.module === module))}
                        aria-pressed={step.module === module}
                        className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs sm:flex-row sm:gap-2 ${step.module === module ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-600'}`}
                      >
                        {done ? <CheckCircle2 className="h-4 w-4" /> : <ModuleIcon className="h-4 w-4" />}
                        {labels[module]}
                      </button>
                    );
                  })}
                </div>
                <progress
                  aria-label={t('Lesson progress', '课时进度', 'Tiến độ bài học')}
                  max={progress.total}
                  value={progress.completed}
                  className="mt-4 block h-1.5 w-full overflow-hidden rounded-full appearance-none [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-emerald-500 [&::-moz-progress-bar]:bg-emerald-500"
                />
                <p className="mt-2 text-xs text-slate-500">
                  {t(
                    `${progress.completed} / ${progress.total} exercises completed`,
                    `${progress.completed} / ${progress.total} 个练习已完成`,
                    `Đã xong ${progress.completed} / ${progress.total} bài tập`,
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <Icon className="h-4 w-4 text-indigo-600" />
                {labels[step.module]} ·{' '}
                {t(
                  `Item ${(index % lesson.exercises.length) + 1} of ${lesson.exercises.length}`,
                  `第 ${(index % lesson.exercises.length) + 1} / ${lesson.exercises.length} 项`,
                  `Mục ${(index % lesson.exercises.length) + 1} / ${lesson.exercises.length}`,
                )}
              </div>
              {unit.materialType !== 'video' && step.module === 'listen' && step.item.metadata?.audioUrl && (
                <LessonMedia key={`audio:${step.item.id}`} item={step.item} />
              )}
              <SingleItemPractice
                key={`${lesson.id}:${step.item.id}:${step.module}`}
                item={step.item}
                module={step.module}
                course
                onWriteNext={
                  step.module === 'write' && progress.steps[index + 1]?.module === 'write'
                    ? () => setStepIndex((current) => (current === index ? index + 1 : current))
                    : undefined
                }
              />
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-5 shadow-sm">
                <p role="status" className="text-sm text-slate-600">
                  {step.completed
                    ? t(
                        'Practice saved. Ready for the next step.',
                        '练习已保存，可以继续下一步。',
                        'Đã lưu bài luyện. Sẵn sàng bước tiếp theo.',
                      )
                    : t(
                        'Complete this exercise to continue. Your progress saves automatically.',
                        '完成当前练习后继续，进度将自动保存。',
                        'Hoàn thành bài tập này để tiếp tục. Tiến độ tự lưu.',
                      )}
                </p>
                <button
                  type="button"
                  disabled={!step.completed}
                  onClick={() => {
                    if (index + 1 < progress.total) setStepIndex(index + 1);
                    else if (lessons[lesson.order + 1]) openLesson(lessons[lesson.order + 1].id);
                    else window.location.assign('/dashboard');
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {t('Continue', '继续', 'Tiếp tục')}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
