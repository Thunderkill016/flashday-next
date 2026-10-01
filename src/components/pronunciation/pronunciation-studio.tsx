'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, Headphones, Mic, Square, Volume2 } from 'lucide-react';
import { nanoid } from 'nanoid';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { usePronunciationStudio } from '@/hooks/use-pronunciation-studio';
import { db, LOCAL_DATABASE_CHANGED_EVENT } from '@/lib/db';
import { LOCALE_TAGS } from '@/lib/i18n/locale';
import { PRONUNCIATION_SOUNDS } from '@/lib/pronunciation-practice';
import {
  getPronunciationProgression,
  getSoundPairIndex,
  type SoundEvidenceStatus,
} from '@/lib/pronunciation-progression';
import { legacyPracticedIds, MINIMAL_PAIRS, recognitionMatches, STUDIO_SOUNDS } from '@/lib/pronunciation-training';
import { resolveWeakSpot, upsertWeakSpot } from '@/lib/weak-spots';
import { useLanguageStore } from '@/stores/language-store';
import { usePronunciationStore } from '@/stores/pronunciation-store';

const button =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:border-indigo-300 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-50';

export function PronunciationStudio() {
  const [scope, setScope] = useState(0);
  useEffect(() => {
    const change = () => setScope((value) => value + 1);
    window.addEventListener(LOCAL_DATABASE_CHANGED_EVENT, change);
    return () => window.removeEventListener(LOCAL_DATABASE_CHANGED_EVENT, change);
  }, []);
  return <StudioWorkspace key={scope} />;
}

function StudioWorkspace() {
  const [database] = useState(() => db);
  const language = useLanguageStore((s) => s.interfaceLanguage);
  const t = (en: string, cn: string, vi: string) => (language === 'zh' ? cn : language === 'vi' ? vi : en);
  const [soundId, setSoundId] = useState('ih');
  const [wordIndex, setWordIndex] = useState(0);
  const [pairIndex, setPairIndex] = useState(0);
  const [answer, setAnswer] = useState<number | null>(null);
  const [choice, setChoice] = useState<number | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [persistError, setPersistError] = useState(false);
  const sound = STUDIO_SOUNDS.find((s) => s.id === soundId) ?? STUDIO_SOUNDS[0];
  const word = sound.examples[wordIndex] ?? sound.examples[0];
  const studio = usePronunciationStudio(word);
  const pair = MINIMAL_PAIRS[pairIndex];
  const settings = usePronunciationStore();
  const progress = useLiveQuery(() => database.pronunciationProgress.toArray(), [database]) ?? [];
  const progression = getPronunciationProgression(progress, soundId);
  const evidence = progression.bySound[sound.id];
  const statusLabel = (status: SoundEvidenceStatus) =>
    ({
      new: t('Not started', '未开始', 'Chưa bắt đầu'),
      legacy: t('Legacy history', '旧版记录', 'Lịch sử cũ'),
      listening: t('Listening only', '仅听辨', 'Chỉ nghe'),
      recognition: t('Recognition only', '仅词语识别', 'Chỉ nhận dạng'),
      recorded: t('Recorded', '已录音', 'Đã thu'),
      assessed: t('Assessed', '已评估', 'Đã đánh giá'),
    })[status];
  const savedAudio = useRef<string | null>(null);
  const savedAssessment = useRef<unknown>(null);
  const playback = useRef(0);

  useEffect(() => {
    usePronunciationStore.getState().hydrate();
    const id = new URLSearchParams(window.location.search).get('sound');
    if (id && STUDIO_SOUNDS.some((s) => s.id === id)) {
      setSoundId(id);
      const index = getSoundPairIndex(id);
      if (index >= 0) setPairIndex(index);
    }
    try {
      const ids =
        database.name === 'echotype:anonymous'
          ? legacyPracticedIds(localStorage.getItem('echotype:pronunciation-practice:v1'))
          : [];
      void database
        .transaction('rw', database.pronunciationProgress, async () => {
          for (const soundId of ids) {
            const id = `legacy:${soundId}`;
            if (!(await database.pronunciationProgress.get(id)))
              await database.pronunciationProgress.add({ id, soundId, kind: 'legacy', updatedAt: Date.now() });
          }
        })
        .catch(() => setPersistError(true));
    } catch {
      setPersistError(true);
    }
    return () => {
      playback.current++;
      window.speechSynthesis?.cancel();
    };
  }, [database]);

  useEffect(() => {
    if (!studio.audioUrl || savedAudio.current === studio.audioUrl) return;
    savedAudio.current = studio.audioUrl;
    void database.pronunciationProgress
      .add({ id: nanoid(), soundId, kind: 'recording', updatedAt: Date.now() })
      .catch(() => setPersistError(true));
  }, [studio.audioUrl, soundId, database]);

  useEffect(() => {
    if (!studio.assessment || savedAssessment.current === studio.assessment) return;
    savedAssessment.current = studio.assessment;
    const assessment = studio.assessment;
    void (async () => {
      await database.pronunciationProgress.add({
        id: nanoid(),
        soundId,
        kind: 'speechsuper',
        assessment,
        updatedAt: Date.now(),
      });
      for (const phoneme of assessment.phonemes.filter((p) => p.score < 60)) {
        if (db !== database) return;
        await upsertWeakSpot({
          module: 'speak',
          weakSpotType: 'pronunciation-phrase',
          sourceId: soundId,
          sourceType: 'session',
          text: `${word} /${phoneme.phoneme}/`,
          reason: `SpeechSuper phoneme score: ${phoneme.score}`,
          targetHref: `/pronunciation?sound=${encodeURIComponent(soundId)}`,
          accuracy: phoneme.score,
        });
      }
    })().catch(() => setPersistError(true));
  }, [studio.assessment, soundId, word, database]);

  function speak(text: string, ready?: () => void) {
    if (!window.speechSynthesis) {
      setNotice(
        t(
          'Speech playback is unsupported in this browser.',
          '当前浏览器不支持语音播放。',
          'Trình duyệt này không hỗ trợ phát giọng nói.',
        ),
      );
      return;
    }
    const token = ++playback.current;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = 0.85;
    const british = window.speechSynthesis.getVoices().find((v) => v.lang === 'en-GB');
    if (british) utterance.voice = british;
    utterance.onend = () => {
      if (token === playback.current) ready?.();
    };
    utterance.onerror = () => {
      if (token === playback.current)
        setNotice(
          t(
            'Audio could not play. Try again or choose another browser.',
            '无法播放音频，请重试或更换浏览器。',
            'Không phát được audio. Thử lại hoặc đổi trình duyệt khác.',
          ),
        );
    };
    setNotice('');
    window.speechSynthesis.speak(utterance);
  }

  function chooseSound(id: string) {
    playback.current++;
    window.speechSynthesis?.cancel();
    setSoundId(id);
    setWordIndex(0);
    const index = getSoundPairIndex(id);
    setPairIndex(index >= 0 ? index : 0);
    setAnswer(null);
    setChoice(null);
    setAudioReady(false);
    window.history.replaceState(null, '', `/pronunciation?sound=${encodeURIComponent(id)}`);
  }

  function playQuiz() {
    if (choice !== null) return;
    const next = answer ?? (Math.random() < 0.5 ? 0 : 1);
    setAnswer(next);
    setAudioReady(false);
    speak(pair.words[next], () => setAudioReady(true));
  }

  async function submitChoice(selected: number) {
    if (choice !== null || answer === null || !audioReady) return;
    setChoice(selected);
    const correct = selected === answer;
    try {
      await database.pronunciationProgress.add({
        id: nanoid(),
        soundId: pair.soundId,
        kind: 'listening',
        correct,
        updatedAt: Date.now(),
      });
      if (db !== database) return;
      if (!correct)
        await upsertWeakSpot({
          module: 'listen',
          weakSpotType: 'listening-segment',
          sourceId: pair.soundId,
          sourceType: 'session',
          text: pair.words.join(' / '),
          reason: 'Minimal-pair listening needs practice',
          targetHref: `/pronunciation?sound=${pair.soundId}`,
        });
      else
        await resolveWeakSpot({
          module: 'listen',
          weakSpotType: 'listening-segment',
          text: pair.words.join(' / '),
        });
    } catch {
      setPersistError(true);
    }
  }

  const practiced = progression.practicedCount;
  const busy = studio.recording || studio.starting || studio.assessing;
  return (
    <main className="mx-auto w-full max-w-6xl space-y-7 px-4 py-7 text-slate-800 sm:px-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
          {t('Pronunciation studio', '发音练习室', 'Phòng luyện phát âm')}
        </p>
        <h1 className="font-[family-name:var(--font-poppins)] text-3xl font-semibold tracking-tight sm:text-4xl">
          {t(
            'Hear the difference. Find your voice.',
            '听清差别，练好发音。',
            'Nghe rõ sự khác biệt. Tìm giọng của bạn.',
          )}
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">
          {t(
            'Listen, compare, record, and replay. Recognition checks words; only acoustic assessment can report pronunciation metrics.',
            '先听辨，再录音回放。语音识别只核对词语；只有声学评估才能提供发音指标。',
            'Nghe, so sánh, thu âm và nghe lại. Nhận dạng chỉ kiểm tra từ; chỉ đánh giá âm học mới cho chỉ số phát âm.',
          )}
        </p>
        <p className="text-xs text-slate-500">
          {t(
            `${practiced} / 48 sounds practiced on this device · Recording or professional evidence; practice is not mastery.`,
            `本机已练习 ${practiced} / 48 个音标 · 以录音或专业评估为依据，练习不代表掌握。`,
            `Đã luyện ${practiced} / 48 âm trên thiết bị này · Cần bằng chứng thu âm hoặc đánh giá chuyên nghiệp; luyện tập không bằng thành thạo.`,
          )}
        </p>
        <button type="button" className={button} disabled={busy} onClick={() => chooseSound(progression.nextSound.id)}>
          {t(
            `Next sound: /${progression.nextSound.ipa}/`,
            `下一个音标：/${progression.nextSound.ipa}/`,
            `Âm tiếp theo: /${progression.nextSound.ipa}/`,
          )}
          <ArrowRight size={16} />
        </button>
        <p className="text-xs text-slate-500">
          {t(
            'Next unpracticed sound in chart order; then revisit the oldest practice.',
            '按音标表顺序推荐未练习项；全部练过后，复习最早的练习项。',
            'Ưu tiên âm chưa luyện theo thứ tự bảng; khi hết thì ôn lại phần luyện cũ nhất.',
          )}
        </p>
      </header>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7" aria-labelledby="listen-heading">
        <div className="flex items-center gap-2 text-indigo-600">
          <Headphones size={20} />
          <h2 id="listen-heading" className="text-lg font-semibold">
            {t('1. Hear the difference', '1. 听辨差别', '1. Nghe và phân biệt')}
          </h2>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {getSoundPairIndex(soundId) === pairIndex
            ? t(
                'Play the word, then choose what you heard.',
                '播放单词，然后选择你听到的词。',
                'Nghe từ rồi chọn từ bạn nghe được.',
              )
            : t(
                `General listening practice · No minimal pair for /${sound.ipa}/ yet. Recording below stays on /${sound.ipa}/.`,
                `通用听辨练习 · /${sound.ipa}/ 暂无对应词对。下方仍练习 /${sound.ipa}/ 录音。`,
                `Luyện nghe tổng quát · /${sound.ipa}/ chưa có cặp từ tối thiểu. Phần thu bên dưới vẫn luyện /${sound.ipa}/.`,
              )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {MINIMAL_PAIRS.map((p, i) => (
            <button
              type="button"
              key={p.soundId}
              disabled={busy}
              aria-pressed={pairIndex === i}
              className={`${button} ${pairIndex === i ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : ''}`}
              onClick={() => chooseSound(p.soundId)}
            >
              {p.words.join(' / ')}
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className={`${button} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700`}
            disabled={busy || choice !== null}
            onClick={playQuiz}
          >
            <Volume2 size={18} />
            {t('Play question', '播放题目', 'Phát câu hỏi')}
          </button>
          {pair.words.map((value, i) => (
            <button
              type="button"
              key={value}
              className={button}
              disabled={!audioReady || choice !== null || busy}
              onClick={() => void submitChoice(i)}
            >
              {value}
            </button>
          ))}
        </div>
        {choice !== null && (
          <div className="mt-4 space-y-3" role="status">
            <p className="text-sm">
              {choice === answer
                ? t('Correct listening choice.', '听辨正确。', 'Chọn đúng phần nghe.')
                : t(
                    `You heard “${pair.words[answer!]}”. Compare both words and try again.`,
                    `刚才播放的是 “${pair.words[answer!]}”。对比两个词后再试一次。`,
                    `Bạn vừa nghe “${pair.words[answer!]}”. So sánh hai từ rồi thử lại.`,
                  )}
            </p>
            <div className="flex flex-wrap gap-2">
              {pair.words.map((value) => (
                <button type="button" className={button} key={value} disabled={busy} onClick={() => speak(value)}>
                  <Volume2 size={16} />
                  {value}
                </button>
              ))}
              <button
                type="button"
                className={button}
                onClick={() => {
                  setChoice(null);
                  setAnswer(null);
                  setAudioReady(false);
                }}
              >
                {t('Next question', '下一题', 'Câu tiếp')}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.15fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="chart-heading">
          <h2 id="chart-heading" className="text-lg font-semibold">
            {t('48-entry teaching chart', '48 项教学音标表', 'Bảng 48 âm vị học')}
          </h2>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {t(
              '20 vowels + 24 consonants + 4 consonant clusters. This is a common teaching convention, not 48 distinct phonemes. British reference; accents and device voices vary.',
              '20 个元音 + 24 个辅音 + 4 个辅音组合。这是常见教学分类，不代表 48 个独立音位。采用英式参考，口音与设备语音可能不同。',
              '20 nguyên âm + 24 phụ âm + 4 cụm phụ âm. Đây là cách chia quen thuộc trong giảng dạy, không phải 48 âm vị riêng biệt. Tham chiếu Anh-Anh; giọng và thiết bị có thể khác.',
            )}
          </p>
          {(['vowel', 'consonant', 'cluster'] as const).map((group) => (
            <div key={group} className="mt-5">
              <h3 className="mb-2 text-xs font-semibold text-slate-500">
                {group === 'vowel'
                  ? t('Vowels', '元音', 'Nguyên âm')
                  : group === 'consonant'
                    ? t('Consonants', '辅音', 'Phụ âm')
                    : t('Consonant clusters', '辅音组合', 'Cụm phụ âm')}
              </h3>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {STUDIO_SOUNDS.filter((s) => s.group === group).map((s) => (
                  <button
                    type="button"
                    key={s.id}
                    aria-label={`/${s.ipa}/ ${s.examples[0]}`}
                    aria-pressed={sound.id === s.id}
                    disabled={busy}
                    onClick={() => chooseSound(s.id)}
                    className={`min-h-14 rounded-xl border px-1 py-2 text-lg focus-visible:outline-2 focus-visible:outline-indigo-500 ${sound.id === s.id ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 hover:bg-indigo-50'} disabled:opacity-60`}
                  >
                    /{s.ipa}/
                    <span className="mt-1 block text-[10px] leading-3">
                      {statusLabel(progression.bySound[s.id].status)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>

        <section
          className="space-y-5 rounded-3xl border border-indigo-100 bg-indigo-50/50 p-5 sm:p-7"
          aria-labelledby="record-heading"
        >
          <h2 id="record-heading" className="text-lg font-semibold">
            {t('2. Shape the sound', '2. 练习发音', '2. Luyện phát âm')}
          </h2>
          <div className="text-5xl font-medium text-indigo-700">/{sound.ipa}/</div>
          <div
            data-testid="sound-evidence"
            className="space-y-2 rounded-xl bg-white p-4 text-xs text-slate-600"
            aria-live="polite"
          >
            <p className="font-medium text-indigo-700">
              {statusLabel(evidence.status)} · {t('Recent evidence', '近期记录', 'Dữ liệu gần đây')}
            </p>
            {!evidence.recent.length && (
              <p>
                {t(
                  'No evidence yet. Listen, then record this sound.',
                  '暂无记录。先听示例，再录下这个音。',
                  'Chưa có dữ liệu. Nghe mẫu, rồi thu âm thanh này.',
                )}
              </p>
            )}
            {evidence.recent.map((entry) => (
              <div key={entry.id}>
                <p>
                  <time dateTime={new Date(entry.updatedAt).toISOString()}>
                    {new Date(entry.updatedAt).toLocaleString(LOCALE_TAGS[language])}
                  </time>{' '}
                  ·{' '}
                  {entry.kind === 'recording'
                    ? t(
                        'Recording saved (audio is temporary)',
                        '录音练习已记录（音频仅暂存）',
                        'Đã lưu lần thu (audio chỉ giữ tạm)',
                      )
                    : entry.kind === 'speechsuper'
                      ? 'SpeechSuper'
                      : entry.kind === 'listening'
                        ? entry.correct
                          ? t('Correct listening choice', '听辨正确', 'Chọn đúng phần nghe')
                          : t('Listening needs practice', '听辨待练习', 'Nghe cần luyện thêm')
                        : entry.kind === 'legacy'
                          ? t('Unverified legacy history', '未经验证的旧版记录', 'Lịch sử cũ chưa kiểm chứng')
                          : t('Word recognition only', '仅词语识别', 'Chỉ nhận dạng từ')}
                </p>
                {entry.kind === 'speechsuper' && entry.assessment && (
                  <p className="mt-1">
                    {[
                      entry.assessment.overall !== undefined
                        ? `${t('Overall', '综合', 'Tổng thể')} ${entry.assessment.overall}/100`
                        : null,
                      entry.assessment.fluency !== undefined
                        ? `${t('Fluency', '流利度', 'Độ trôi chảy')} ${entry.assessment.fluency}/100`
                        : null,
                      entry.assessment.completeness !== undefined
                        ? `${t('Completeness', '完整度', 'Độ đầy đủ')} ${entry.assessment.completeness}/100`
                        : null,
                      ...entry.assessment.phonemes.map((p) => `/${p.phoneme}/ ${p.score}/100`),
                    ]
                      .filter(Boolean)
                      .join(' · ') ||
                      t('No acoustic metrics saved.', '未保存声学指标。', 'Chưa lưu chỉ số âm học nào.')}
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="text-sm leading-6">{t(sound.tip, sound.tipZh, sound.tipVi)}</p>
          <div className="flex flex-wrap gap-2">
            {sound.examples.map((example, i) => (
              <button
                type="button"
                key={example}
                className={`${button} ${word === example ? 'border-indigo-400 text-indigo-700' : ''}`}
                disabled={busy}
                aria-pressed={word === example}
                onClick={() => {
                  setWordIndex(i);
                  speak(example);
                }}
              >
                <Volume2 size={16} />
                {example}
              </button>
            ))}
          </div>
          <p className="text-xs leading-5 text-slate-500">
            {t(
              'Examples use your device’s synthesized voice, not a recording of an isolated phoneme.',
              '示例使用设备合成语音，并非单独音素的真人录音。',
              'Ví dụ dùng giọng tổng hợp của thiết bị, không phải bản thu âm vị riêng lẻ.',
            )}
          </p>
          <div className="border-t border-indigo-100 pt-5">
            <h3 className="font-semibold">{t(`3. Record “${word}”`, `3. 录下 “${word}”`, `3. Thu “${word}”`)}</h3>
            <p className="mt-2 text-xs text-slate-500">
              {t(
                'Up to 20 seconds. Recording stays in memory for replay.',
                '每次最多 20 秒。录音仅暂存内存，供回放使用。',
                'Tối đa 20 giây. Bản thu chỉ giữ trong bộ nhớ để nghe lại.',
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`${button} border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700`}
              disabled={studio.starting || studio.assessing}
              onClick={() => {
                window.speechSynthesis?.cancel();
                if (studio.recording) studio.stop();
                else void studio.start();
              }}
            >
              {studio.recording ? <Square size={18} /> : <Mic size={18} />}
              {studio.recording
                ? t('Stop recording', '停止录音', 'Dừng ghi âm')
                : studio.starting
                  ? t('Opening microphone…', '正在打开麦克风…', 'Đang mở micro…')
                  : t('Record word', '录制单词', 'Thu từ')}
            </button>
          </div>
          {studio.audioUrl && (
            <audio
              className="w-full"
              controls
              src={studio.audioUrl}
              aria-label={t('Replay your recording', '回放你的录音', 'Nghe lại bản thu của bạn')}
            />
          )}
          <div className="rounded-xl bg-white p-4 text-sm" aria-live="polite">
            <p className="font-medium">
              {t('Browser word recognition', '浏览器词语识别', 'Nhận dạng từ của trình duyệt')}
            </p>
            <p className="mt-2 text-slate-600">
              {studio.transcript
                ? `“${studio.transcript}” — ${recognitionMatches(word, studio.transcript) ? t('Target word recognized', '已识别出目标词', 'Đã nhận ra từ mục tiêu') : t('Target word not recognized', '未识别出目标词', 'Không nhận ra từ mục tiêu')}`
                : t('No recognized words yet.', '尚未识别到词语。', 'Chưa nhận dạng được từ nào.')}
            </p>
            {studio.recognitionStatus && <p className="mt-2 text-xs">{studio.recognitionStatus}</p>}
            <p className="mt-2 text-xs text-slate-500">
              {t(
                'Recognition is not a pronunciation score and cannot verify a phoneme.',
                '识别结果不是发音评分，也不能验证音素。',
                'Nhận dạng không phải điểm phát âm và không kiểm chứng được âm vị.',
              )}
            </p>
          </div>
          <div className="space-y-3 border-t border-indigo-100 pt-5">
            <h3 className="font-semibold">
              {t('Professional acoustic assessment', '专业声学评估', 'Đánh giá âm học chuyên nghiệp')}
            </h3>
            <p className="text-xs leading-5 text-slate-600">
              {t(
                'SpeechSuper assesses the recorded audio. Running this sends the recording to SpeechSuper using your configured account and may use paid quota.',
                'SpeechSuper 对录音进行声学评估。运行后会使用已配置的账户发送录音，可能消耗付费额度。',
                'SpeechSuper đánh giá âm học bản thu. Khi chạy, bản thu được gửi tới SpeechSuper qua tài khoản bạn đã cấu hình và có thể trừ quota trả phí.',
              )}
            </p>
            {settings.speechSuperAppKey && settings.speechSuperSecretKey ? (
              <button
                type="button"
                className={button}
                disabled={!studio.audioUrl || busy}
                onClick={() => void studio.assess()}
              >
                {studio.assessing
                  ? t('Assessing…', '评估中…', 'Đang đánh giá…')
                  : t('Assess with SpeechSuper', '使用 SpeechSuper 评估', 'Đánh giá bằng SpeechSuper')}
              </button>
            ) : (
              <Link className={button} href="/settings">
                {t('Configure SpeechSuper', '配置 SpeechSuper', 'Cấu hình SpeechSuper')}
                <ArrowRight size={16} />
              </Link>
            )}
            {studio.assessment && (
              <div className="rounded-xl bg-white p-4" aria-live="polite">
                <p className="text-xs font-medium text-indigo-700">
                  SpeechSuper · {t('Acoustic results', '声学结果', 'Kết quả âm học')}
                </p>
                <dl className="mt-3 grid grid-cols-3 gap-2">
                  {(
                    [
                      [t('Overall', '综合', 'Tổng thể'), studio.assessment.overall],
                      [t('Fluency', '流利度', 'Độ trôi chảy'), studio.assessment.fluency],
                      [t('Completeness', '完整度', 'Độ đầy đủ'), studio.assessment.completeness],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className="mt-1 font-semibold">{value === undefined ? '—' : `${value}/100`}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-xs text-slate-500">
                  {t('Provider-reported phonemes', '服务商返回的音素', 'Âm vị do nhà cung cấp báo')}
                </p>
                {studio.assessment.phonemes.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {studio.assessment.phonemes.map((p, i) => (
                      <span className="rounded-lg border border-slate-200 px-2 py-1 text-sm" key={`${p.phoneme}-${i}`}>
                        /{p.phoneme}/ {p.score}/100
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm">
                    {t('No phoneme metrics returned.', '未返回音素指标。', 'Không nhận được chỉ số âm vị.')}
                  </p>
                )}
              </div>
            )}
          </div>
          {studio.error && (
            <p role="alert" className="text-sm text-red-700">
              {studio.error}
            </p>
          )}
        </section>
      </div>

      {notice && (
        <p role="alert" className="text-sm text-amber-800">
          {notice}
        </p>
      )}
      {persistError && (
        <p role="alert" className="text-sm text-amber-800">
          {t(
            'Practice could not be saved on this device. You can continue practicing.',
            '无法在此设备保存练习记录，你仍可继续练习。',
            'Không lưu được bài luyện trên thiết bị này. Bạn vẫn có thể tiếp tục luyện.',
          )}
        </p>
      )}
      <details className="rounded-3xl border border-slate-200 bg-white p-5">
        <summary className="min-h-11 cursor-pointer text-sm font-medium">
          {t(
            `Original phonics reference (${PRONUNCIATION_SOUNDS.length} entries)`,
            `原有自然拼读参考（${PRONUNCIATION_SOUNDS.length} 项）`,
            `Tham chiếu phonics gốc (${PRONUNCIATION_SOUNDS.length} mục)`,
          )}
        </summary>
        <p className="mb-4 text-xs leading-5 text-slate-500">
          {t(
            'Preserved separately: 39 sound references and 22 spelling patterns. Repeated vowel spellings are not additional phonemes. Earlier completion records remain unverified practice.',
            '独立保留原有的 39 个语音参考与 22 个拼写规律。重复的元音拼写不算新增音位。以往的完成记录仅作为未经验证的练习历史。',
            'Giữ riêng: 39 tham chiếu âm và 22 quy luật chính tả. Nguyên âm trùng cách viết không tính thêm âm vị. Lịch sử hoàn thành cũ chỉ là luyện tập chưa kiểm chứng.',
          )}
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PRONUNCIATION_SOUNDS.map((s) => (
            <div className="rounded-xl bg-slate-50 p-3 text-sm" key={s.id}>
              <p className="font-medium">
                /{s.ipa}/ {s.pattern ? `· ${s.pattern}` : ''}
              </p>
              <p className="mt-1 text-slate-600">{s.examples.join(', ')}</p>
            </div>
          ))}
        </div>
      </details>
      <p className="pb-4 text-xs leading-5 text-slate-500">
        {t(
          'Practice history is stored on this device and does not currently sync across devices. Listening errors and provider-reported low phoneme scores are added to Weak Spots; browser recognition mismatches are not.',
          '练习历史保存在此设备，暂不跨设备同步。听辨错误与服务商返回的低分音素会加入薄弱项；浏览器识别不匹配不会加入。',
          'Lịch sử luyện lưu trên thiết bị này, hiện chưa đồng bộ. Lỗi nghe và âm vị được nhà cung cấp chấm thấp sẽ vào Điểm yếu; nhận dạng trình duyệt lệch thì không.',
        )}
      </p>
    </main>
  );
}
