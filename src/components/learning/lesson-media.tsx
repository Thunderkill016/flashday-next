'use client';
import { nanoid } from 'nanoid';
import { useEffect, useRef, useState } from 'react';
import { useMediaUrl } from '@/hooks/use-media-url';
import { savePracticeSession } from '@/lib/daily-plan-progress';
import { useLT } from '@/lib/i18n/locale';
import { useLanguageStore } from '@/stores/language-store';
import type { ContentItem } from '@/types/content';

export function LessonMedia({ item }: { item: ContentItem }) {
  const url = useMediaUrl(item.metadata?.audioUrl);
  const t = useLT();
  const ref = useRef<HTMLVideoElement>(null);
  const seen = useRef(new Set<number>());
  const last = useRef<number | null>(null);
  const saved = useRef(false);
  const [error, setError] = useState('');
  const segments = item.metadata?.timestamps;
  const start = segments?.[0]?.offset ?? 0;
  const end = segments?.length ? Math.max(...segments.map((s) => s.offset + s.duration)) : undefined;
  const video =
    item.metadata?.materialType === 'video' ||
    item.metadata?.mediaKind === 'video' ||
    /\.(mp4|webm|mov|avi|mkv)$/i.test(item.metadata?.sourceFilename ?? '');
  let youtubeId = '';
  try {
    const source = new URL(item.metadata?.sourceUrl || '');
    if (source.hostname === 'youtu.be') youtubeId = source.pathname.slice(1);
    else if (/(^|\.)youtube\.com$/.test(source.hostname)) youtubeId = source.searchParams.get('v') || '';
  } catch {
    /* Not a remote video. */
  }
  const Media = video ? 'video' : 'audio';
  useEffect(() => {
    seen.current.clear();
    last.current = null;
    saved.current = false;
    setError('');
  }, []);
  const onTime = () => {
    const audio = ref.current;
    if (!audio) return;
    const current = audio.currentTime;
    if (last.current !== null && current >= last.current && current - last.current < 2) {
      for (
        let n = Math.max(Math.floor(start), Math.floor(last.current));
        n < Math.min(Math.floor(end ?? audio.duration), Math.floor(current));
        n++
      )
        seen.current.add(n);
    }
    last.current = current;
    const stop = end ?? audio.duration;
    if (current >= stop - 0.15) {
      audio.pause();
      if (!saved.current && Number.isFinite(stop) && seen.current.size >= Math.floor((stop - start) * 0.85)) {
        saved.current = true;
        void savePracticeSession(
          {
            id: nanoid(),
            contentId: item.id,
            module: 'listen',
            startTime: Date.now() - seen.current.size * 1000,
            endTime: Date.now(),
            totalChars: item.text.length,
            correctChars: 0,
            wrongChars: 0,
            totalWords: item.text.split(/\s+/).length,
            wpm: 0,
            accuracy: 0,
            completed: true,
          },
          { content: item },
        ).catch(() => {
          saved.current = false;
          setError(
            t(
              'Could not save. Replay to retry.',
              '保存失败，请重新播放后重试。',
              'Không lưu được. Phát lại rồi thử lại.',
            ),
          );
        });
      }
    }
  };
  if (video && /^[\w-]{1,20}$/.test(youtubeId))
    return (
      <iframe
        title={t('Lesson video', '课程视频', 'Video bài học')}
        className="aspect-video w-full rounded-xl"
        src={`https://www.youtube-nocookie.com/embed/${youtubeId}?start=${Math.floor(start)}`}
        allow="fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  if (!url)
    return (
      <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        {t(
          'Original media is unavailable on this device. You can use text-to-speech below.',
          '原媒体在当前设备不可用，可使用下方文字朗读。',
          'Media gốc không có trên thiết bị này. Bạn có thể dùng phát giọng văn bản bên dưới.',
        )}
      </p>
    );
  return (
    <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-800">
        {t('Original recording', '原声精听', 'Bản gốc nghe kỹ')} · {Math.floor(start)}s
        {end ? ` – ${Math.ceil(end)}s` : ''}
      </p>
      <Media
        ref={ref}
        aria-label={t('Lesson recording', '课程原声', 'Bản ghi bài học')}
        className={video ? 'aspect-video max-h-[45vh] w-full rounded-xl bg-black' : 'w-full'}
        controls
        src={url}
        preload="metadata"
        onLoadedMetadata={() => {
          if (ref.current) ref.current.currentTime = start;
        }}
        onSeeking={() => {
          last.current = null;
        }}
        onPlay={() => {
          if (ref.current && (ref.current.currentTime < start || (end && ref.current.currentTime >= end)))
            ref.current.currentTime = start;
        }}
        onTimeUpdate={onTime}
        onEnded={onTime}
        onError={() =>
          setError(
            t(
              'Unable to play this audio. Check the original file.',
              '无法播放该音频，请检查原文件。',
              'Không phát được audio này. Kiểm tra tệp gốc.',
            ),
          )
        }
      >
        <track kind="captions" />
      </Media>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
