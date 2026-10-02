'use client';

import { ArrowLeft, PartyPopper, Volume2 } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Rating } from 'ts-fsrs';
import {
  IOS_EMPTY_STATE_CARD_CLASS,
  IOS_EYEBROW_CLASS,
  IOS_PAGE_CONTAINER_CLASS,
  IOS_PILL_CLASS,
  IOS_PRIMARY_BUTTON_CLASS,
  IOS_SECTION_CARD_CLASS,
  IOS_SUBCARD_CLASS,
  IOS_TERTIARY_BUTTON_CLASS,
  IOS_TINTED_SUBCARD_CLASS,
  IOSPageHeader,
} from '@/components/shared/ios-native-ui';
import { PageSpinner } from '@/components/shared/page-spinner';
import { Button } from '@/components/ui/button';
import { db, LOCAL_DATABASE_CHANGED_EVENT } from '@/lib/db';
import { previewRatings } from '@/lib/fsrs';
import { useI18n } from '@/lib/i18n/use-i18n';
import { detectIOSNativeHost, reportNativeQAState } from '@/lib/tauri';
import { cn } from '@/lib/utils';
import { useFavoriteStore } from '@/stores/favorite-store';

export function FavoritesReview() {
  return (
    <Suspense fallback={<PageSpinner size="sm" className="min-h-[40vh]" />}>
      <FavoritesReviewRoute />
    </Suspense>
  );
}

function FavoritesReviewRoute() {
  const targetId = useSearchParams().get('item');
  const [databaseName, setDatabaseName] = useState(db.name);
  useEffect(() => {
    const change = () => setDatabaseName(db.name);
    window.addEventListener(LOCAL_DATABASE_CHANGED_EVENT, change);
    return () => window.removeEventListener(LOCAL_DATABASE_CHANGED_EVENT, change);
  }, []);
  return <FavoritesReviewSession key={`${databaseName}:${targetId ?? '*'}`} targetId={targetId} />;
}

function FavoritesReviewSession({ targetId }: { targetId: string | null }) {
  const isIOSNativeHost = detectIOSNativeHost();
  const { messages: t } = useI18n('favorites');
  const { messages: reviewMessages } = useI18n('review');
  const gradeReview = useFavoriteStore((s) => s.gradeReview);
  const isLoaded = useFavoriteStore((s) => s.isLoaded);
  const [revealed, setRevealed] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [grading, setGrading] = useState(false);
  const [gradeError, setGradeError] = useState('');
  const gradingLock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const currentIndex = completedCount;

  const favorites = useFavoriteStore((s) => s.favorites);
  const dueItems = useMemo(() => {
    const now = Date.now();
    return favorites.filter(
      (f) =>
        !reviewedIds.includes(f.id) &&
        (!targetId || f.id === targetId) &&
        (f.fsrsCard?.due ?? f.nextReview ?? Infinity) <= now,
    );
  }, [favorites, targetId, reviewedIds]);
  const totalCount = dueItems.length + completedCount;

  useEffect(() => {
    reportNativeQAState({
      page: 'favorites-review',
      isLoaded,
      totalCount,
      currentIndex,
      completedCount,
      revealed,
    });
  }, [completedCount, currentIndex, isLoaded, revealed, totalCount]);

  if (!isLoaded) {
    return <PageSpinner size="sm" className="min-h-[40vh]" />;
  }

  if (dueItems.length === 0 && !grading) {
    return (
      <div className={isIOSNativeHost ? IOS_PAGE_CONTAINER_CLASS : 'max-w-lg mx-auto text-center py-20'}>
        {isIOSNativeHost ? (
          <>
            <IOSPageHeader title={t.reviewTitle} description={t.reviewEmptyDescription} />
            <div className={cn(IOS_EMPTY_STATE_CARD_CLASS, 'px-6 py-10 text-center')}>
              <div className="mx-auto max-w-sm space-y-4">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-emerald-50 text-emerald-600">
                  <PartyPopper className="h-8 w-8" aria-hidden="true" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-lg font-semibold text-slate-900">
                    {completedCount > 0
                      ? t.reviewCompleted.replace('{{count}}', String(completedCount))
                      : t.noDueFavorites}
                  </p>
                  <p className="text-sm leading-6 text-slate-500">
                    {completedCount > 0 ? t.reviewDoneDetail : t.noDueDetail}
                  </p>
                </div>
                <Link href="/favorites" className="inline-flex">
                  <Button className={cn(IOS_PRIMARY_BUTTON_CLASS, 'gap-1.5')}>
                    <ArrowLeft className="h-4 w-4" />
                    {t.backToFavorites}
                  </Button>
                </Link>
              </div>
            </div>
          </>
        ) : (
          <div className="max-w-lg mx-auto text-center py-20">
            <div className="text-4xl mb-4">&#127881;</div>
            <p className="text-lg font-medium text-slate-700">
              {completedCount > 0 ? t.reviewCompleted.replace('{{count}}', String(completedCount)) : t.noDueFavorites}
            </p>
            <Link href="/favorites">
              <Button variant="outline" className="mt-4 gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                {t.backToFavorites}
              </Button>
            </Link>
          </div>
        )}
      </div>
    );
  }

  if (!dueItems.length) return <PageSpinner size="sm" className="min-h-[40vh]" />;
  const item = dueItems[0]!;
  const previews = previewRatings(item.fsrsCard);

  const handleGrade = async (rating: Rating) => {
    if (gradingLock.current) return;
    const database = db;
    const isCurrent = () => mounted.current && database === db;
    gradingLock.current = true;
    setGrading(true);
    setGradeError('');
    try {
      await gradeReview(item.id, rating);
      if (!isCurrent()) return;
      setReviewedIds((ids) => [...ids, item.id]);
      setCompletedCount((c) => c + 1);
      setRevealed(false);
    } catch {
      if (isCurrent()) setGradeError(t.gradeError);
    } finally {
      gradingLock.current = false;
      if (isCurrent()) setGrading(false);
    }
  };

  const handleTTS = () => {
    window.speechSynthesis?.cancel();
    const u = new SpeechSynthesisUtterance(item.text);
    u.lang = 'en-US';
    window.speechSynthesis?.speak(u);
  };

  const RATING_BUTTONS = [
    { rating: Rating.Again, label: reviewMessages.rating.again, color: 'bg-red-500 hover:bg-red-600' },
    { rating: Rating.Hard, label: reviewMessages.rating.hard, color: 'bg-amber-500 hover:bg-amber-600' },
    { rating: Rating.Good, label: reviewMessages.rating.good, color: 'bg-green-500 hover:bg-green-600' },
    { rating: Rating.Easy, label: reviewMessages.rating.easy, color: 'bg-blue-500 hover:bg-blue-600' },
  ];

  return (
    <div className={isIOSNativeHost ? IOS_PAGE_CONTAINER_CLASS : 'max-w-lg mx-auto'}>
      {gradeError && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {gradeError}
        </p>
      )}
      {isIOSNativeHost ? (
        <>
          <IOSPageHeader title={t.reviewTitle} description={t.reviewDescription} />
          <div className={`${IOS_SECTION_CARD_CLASS} space-y-4 p-4`}>
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/favorites"
                className={cn(IOS_TERTIARY_BUTTON_CLASS, 'inline-flex items-center gap-1.5 text-sm font-semibold')}
                aria-label={t.backToFavorites}
              >
                <ArrowLeft className="h-4 w-4" />
                {t.back}
              </Link>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className={IOS_PILL_CLASS}>
                  {currentIndex + 1} / {totalCount}
                </span>
                <span className={IOS_PILL_CLASS}>{t.doneCount.replace('{{count}}', String(completedCount))}</span>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-slate-900 transition-all duration-300"
                style={{ width: `${(completedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>

          <div
            className={cn(
              IOS_TINTED_SUBCARD_CLASS,
              'min-h-[320px] cursor-pointer px-6 py-7 text-center transition-colors',
              !revealed && 'hover:bg-[linear-gradient(180deg,rgba(232,238,255,0.96)_0%,rgba(255,255,255,0.92)_100%)]',
            )}
            data-testid="favorites-review-card"
            role="button"
            tabIndex={0}
            aria-label="favorites-review-card"
            onClick={() => !revealed && setRevealed(true)}
            onKeyDown={(event) => {
              if (revealed || (event.key !== 'Enter' && event.key !== ' ')) return;
              event.preventDefault();
              setRevealed(true);
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-left">
                <p className={IOS_EYEBROW_CLASS}>{t.savedItem}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className="text-[1.95rem] font-bold tracking-[-0.04em] text-slate-950"
                    data-testid="favorites-review-current-text"
                  >
                    {item.text}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full bg-white/88 text-slate-600 hover:bg-white"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTTS();
                    }}
                  >
                    <Volume2 className="h-4 w-4" />
                  </Button>
                </div>
                {item.type === 'word' && item.pronunciation ? (
                  <p className="mt-2 text-sm font-mono text-slate-400">{item.pronunciation}</p>
                ) : null}
              </div>
              <span className={IOS_PILL_CLASS}>{revealed ? t.revealed : t.tapToReveal}</span>
            </div>

            <div className="mt-8">
              {revealed ? (
                <div className="space-y-3">
                  <div className={`${IOS_SUBCARD_CLASS} px-4 py-4`}>
                    <p className={IOS_EYEBROW_CLASS}>{t.translationLabel}</p>
                    <p className="mt-2 text-lg font-medium text-slate-700">{item.translation}</p>
                  </div>
                  {item.context ? (
                    <div className={`${IOS_SUBCARD_CLASS} px-4 py-4 text-left`}>
                      <p className={IOS_EYEBROW_CLASS}>{t.contextLabel}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">{item.context}</p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className={`${IOS_SUBCARD_CLASS} px-4 py-5`}>
                  <p className="text-sm leading-6 text-slate-500">{t.revealHint}</p>
                </div>
              )}
            </div>
          </div>

          {revealed ? (
            <div className={`${IOS_SECTION_CARD_CLASS} p-4`}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {RATING_BUTTONS.map(({ rating, label, color }) => {
                  const preview = previews[rating];
                  return (
                    <button
                      type="button"
                      key={rating}
                      disabled={grading}
                      onClick={() => handleGrade(rating)}
                      data-testid={`favorites-review-rate-${rating}`}
                      aria-label={`favorites-review-rate-${rating}`}
                      className={cn('rounded-[20px] px-3 py-3.5 text-white transition-colors', color)}
                    >
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="mt-1 block text-[10px] opacity-80">{preview.interval}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/favorites"
              className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
              aria-label={t.backToFavorites}
            >
              <ArrowLeft className="h-4 w-4" /> {t.back}
            </Link>
            <span className="text-sm text-slate-500">
              {currentIndex + 1} / {totalCount}
            </span>
          </div>

          <div className="h-1.5 bg-slate-100 rounded-full mb-8 overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>

          <div
            className={cn(
              'rounded-2xl border border-slate-200 bg-white shadow-sm p-8 text-center min-h-[240px] flex flex-col items-center justify-center',
              !revealed && 'cursor-pointer hover:bg-slate-50 transition-colors',
            )}
            data-testid="favorites-review-card"
            role="button"
            tabIndex={0}
            aria-label="favorites-review-card"
            onClick={() => !revealed && setRevealed(true)}
            onKeyDown={(event) => {
              if (revealed || (event.key !== 'Enter' && event.key !== ' ')) return;
              event.preventDefault();
              setRevealed(true);
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl font-bold text-slate-900" data-testid="favorites-review-current-text">
                {item.text}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTTS();
                }}
              >
                <Volume2 className="h-4 w-4" />
              </Button>
            </div>

            {item.type === 'word' && item.pronunciation && (
              <p className="text-sm text-slate-400 font-mono mb-4">{item.pronunciation}</p>
            )}

            {revealed ? (
              <div className="mt-4 space-y-2">
                <p className="text-lg text-slate-700">{item.translation}</p>
                {item.context && <p className="text-xs text-slate-400 mt-2">{item.context}</p>}
              </div>
            ) : (
              <p className="text-sm text-slate-400 mt-4">{t.flipToReveal}</p>
            )}
          </div>

          {revealed && (
            <div className="grid grid-cols-4 gap-2 mt-6">
              {RATING_BUTTONS.map(({ rating, label, color }) => {
                const preview = previews[rating];
                return (
                  <button
                    type="button"
                    key={rating}
                    disabled={grading}
                    onClick={() => handleGrade(rating)}
                    data-testid={`favorites-review-rate-${rating}`}
                    aria-label={`favorites-review-rate-${rating}`}
                    className={cn('py-3 rounded-xl text-white font-medium text-sm transition-colors', color)}
                  >
                    <span className="block">{label}</span>
                    <span className="block text-[10px] opacity-80 mt-0.5">{preview.interval}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
