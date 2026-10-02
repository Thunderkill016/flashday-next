'use client';

import { Check, Upload, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { useL } from '@/lib/i18n/locale';
import { includedImportBlocks, recoverImportJob } from '@/lib/import-job';
import { scheduleImportedMaterial } from '@/lib/import-schedule';
import { unitIdForContent } from '@/lib/learning-units';
import { MATERIAL_LABELS, MATERIAL_TYPES } from '@/lib/material-types';
import type { ProviderId } from '@/lib/providers';
import { normalizeTags } from '@/lib/utils';
import { parseVocabulary } from '@/lib/vocabulary';
import { useProviderStore } from '@/stores/provider-store';
import type { ImportJob } from '@/types/import-job';
import s from './material-import-v2.module.css';
import { MaterialReviewV2 } from './material-review-v2';
import { useImportDraft } from './use-import-draft';
import { useMaterialPreparation } from './use-material-preparation';

const speechProviders = ['groq', 'openai', 'openrouter'] as const;

export function MaterialImportV2({
  open,
  onClose,
  onImported,
  initialFormat = 'file',
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  initialFormat?: string;
}) {
  const router = useRouter();
  const p = useMaterialPreparation(onImported);
  const { t, selected, busy } = p;
  const pick = useL();
  const activeProviderId = useProviderStore((state) => state.activeProviderId);
  const providers = useProviderStore((state) => state.providers);
  const [speechProviderOverrides, setSpeechProviderOverrides] = useState<Record<string, ProviderId>>({});
  const availableSpeechProvider = speechProviders.find((id) => {
    const auth = providers[id]?.auth;
    return auth?.apiKey?.trim() || auth?.accessToken?.trim();
  });
  const preferredSpeechProvider =
    speechProviders.includes(activeProviderId as (typeof speechProviders)[number]) &&
    (activeProviderId === 'groq' ||
      providers[activeProviderId]?.auth?.apiKey?.trim() ||
      providers[activeProviderId]?.auth?.accessToken?.trim())
      ? activeProviderId
      : (availableSpeechProvider ?? 'groq');
  const speechProviderId = selected
    ? (speechProviderOverrides[selected.id] ?? selected.transcriptionProviderId ?? preferredSpeechProvider)
    : preferredSpeechProvider;
  const [step, setStep] = useState(0);
  const [source, setSource] = useState(
    initialFormat === 'text' ? 'text' : ['url', 'media'].includes(initialFormat) ? 'url' : 'file',
  );
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [runFirst, setRunFirst] = useState(false);
  const [recover, setRecover] = useState(false);
  const [requestedBlock, setRequestedBlock] = useState<string | null>(null);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setRequestedBlock(query.get('job') === selected?.id ? query.get('block') : null);
  }, [selected?.id, open]);
  const [tagText, setTagText] = useState('');
  const [scheduled, setScheduled] = useState(false),
    [scheduling, setScheduling] = useState(false),
    [scheduleError, setScheduleError] = useState('');
  useEffect(() => {
    setScheduled(false);
    setScheduleError('');
  }, [selected?.id]);
  const draft = useImportDraft('text', { text: '' });
  const [text, setText] = draft.field('text');
  const dialog = useRef<HTMLDialogElement>(null),
    body = useRef<HTMLDivElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    subtitles = useRef<HTMLInputElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) {
      dialog.current?.close();
      return;
    }
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.current?.close();
      document.body.style.overflow = previous;
    };
  }, [open]);
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [step]);
  useEffect(() => {
    if (runFirst && selected && !busy) {
      setRunFirst(false);
      if (selected.kind !== 'media' && (selected.status === 'queued' || selected.status === 'cancelled'))
        void p.process();
      else if (selected.status === 'ready') setStep(3);
    }
  }, [runFirst, selected, busy]);
  useEffect(() => {
    if (selected?.status === 'ready') setStep(3);
  }, [selected?.status]);
  useEffect(() => {
    if (!selected && step !== 0) setStep(0);
  }, [p.jobs.length]);
  const currentJobs = p.activeIds.length
    ? p.jobs.filter((j) => p.activeIds.includes(j.id))
    : selected?.batchId
      ? p.jobs.filter((j) => j.batchId === selected.batchId)
      : selected
        ? [selected]
        : p.jobs;
  const completed = currentJobs.filter((j) => j.status === 'needsReview' || j.status === 'ready').length;
  const type = selected?.materialType || 'reading';
  const tags = normalizeTags(selected?.tagsText ?? selected?.tags?.join(',') ?? '');
  const changeTags = (next: string[]) => {
    if (selected) p.setSelected({ ...selected, tags: next, tagsText: next.join(', ') });
  };
  const addTag = () => {
    if (tagText.trim()) {
      changeTags(normalizeTags([...tags, tagText].join(',')));
      setTagText('');
    }
  };
  const flushTag = () => {
    if (tagText.trim() && selected) {
      const next = normalizeTags([...tags, tagText].join(','));
      p.setSelected({ ...selected, tags: next, tagsText: next.join(', ') });
      setTagText('');
      return true;
    }
    return false;
  };
  const isAudio = selected?.kind === 'media' && !/\.(mp4|webm|avi|mov|mkv)$/i.test(selected.filename || '');
  const publish = async (startPractice = false) => {
    const source = await p.publish(normalizeTags([...tags, tagText].join(',')));
    if (source) {
      setTagText('');
      if (startPractice) {
        onClose();
        router.push(`/learn/${encodeURIComponent(unitIdForContent(source))}`);
      }
    }
  };
  const valid =
    !!selected?.title.trim() &&
    includedImportBlocks(selected!).length > 0 &&
    includedImportBlocks(selected!).every((b) => b.text.trim()) &&
    (!selected!.requiresAudioStructure || selected!.audioStructured || type === 'sentences') &&
    (type !== 'wordbook' ||
      (!parseVocabulary(selected!.blocks.map((b) => b.text).join('\n')).errors.length &&
        parseVocabulary(selected!.blocks.map((b) => b.text).join('\n')).rows.length > 0)) &&
    (type !== 'scenario' || (!!selected!.scenario?.role.trim() && !!selected!.scenario?.goal.trim()));
  const start = async () => {
    if (source === 'text') {
      if (await p.addText(text)) setStep(2);
    } else {
      if (source === 'file') await p.addFiles(files);
      else await p.add();
      setStep(1);
      setRunFirst(true);
    }
  };
  const choose = (incoming: File[]) => setFiles(incoming);
  const openJob = async (job: ImportJob) => {
    await p.openJob(recoverImportJob(job));
    setStep(job.status === 'ready' ? 3 : job.status === 'needsReview' ? 2 : 1);
  };
  const queueRow = (job: ImportJob) => (
    <div className={s.item} key={job.id}>
      <div className={s.fileIcon}>{job.filename?.split('.').pop()?.toUpperCase() || 'LINK'}</div>
      <div className={s.info}>
        <strong>{job.title}</strong>
        <p className={`${s.small} ${s.muted}`}>
          {
            {
              queued: t('Waiting to process', '等待处理', 'Chờ xử lý'),
              processing: p.stage || t('Processing', '处理中', 'Đang xử lý'),
              needsReview: t(
                'Text ready · original retained',
                '正文提取完成 · 原文件已保留',
                'Đã có văn bản · giữ nguyên bản gốc',
              ),
              ready: t('Added to library', '已加入资料库', 'Đã vào thư viện'),
              failed: t('Needs your attention', '需要补充处理', 'Cần bạn xử lý'),
              cancelled: t('Paused · original retained', '已暂停 · 原文件已保留', 'Đã tạm dừng · giữ bản gốc'),
            }[job.status]
          }
        </p>
      </div>
      <button disabled={busy} className={s.outline} onClick={() => void openJob(job)}>
        {job.status === 'ready'
          ? t('Learn', '学习', 'Học')
          : job.status === 'needsReview'
            ? t('Review', '校对', 'Ôn tập')
            : t('Open', '打开', 'Mở')}
      </button>
    </div>
  );
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className={s.modal}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className={s.frame}>
        <header className={s.header}>
          <div className={`${s.row} ${s.between}`}>
            <div>
              <div className={s.eyebrow}>FLASHDAY / LEARNING MATERIALS</div>
              <h1 id={titleId}>{t('Add learning material', '添加学习材料', 'Thêm tài liệu học')}</h1>
            </div>
            <button className={s.close} aria-label={t('Close import', '关闭导入', 'Đóng nhập liệu')} onClick={onClose}>
              <X size={20} />
            </button>
          </div>
          <nav aria-label={t('Import progress', '导入进度', 'Tiến độ nhập')}>
            <ol className={s.steps}>
              {[
                t('Choose source', '添加来源', 'Chọn nguồn'),
                t('Process material', '处理材料', 'Xử lý tài liệu'),
                t('Review & organize', '校对与整理', 'Rà soát & sắp xếp'),
                t('Start learning', '开始学习', 'Bắt đầu học'),
              ].map((label, i) => (
                <li className={step === i ? s.active : ''} aria-current={step === i ? 'step' : undefined} key={label}>
                  <b>{i + 1}</b>
                  {label}
                </li>
              ))}
            </ol>
          </nav>
        </header>
        <div className={s.body} ref={body}>
          {step === 0 && (
            <div className={s.source}>
              <aside className={s.sources}>
                {[
                  ['file', t('Upload file', '上传文件', 'Tải tệp lên')],
                  ['text', t('Paste text', '粘贴文本', 'Dán văn bản')],
                  ['url', t('Paste link', '粘贴链接', 'Dán liên kết')],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    className={source === id ? s.active : ''}
                    onClick={() => setSource(id)}
                    disabled={busy}
                  >
                    {label}
                  </button>
                ))}
                <p>
                  {t(
                    'One library. Choose how to learn after adding your source.',
                    '一个资料库。添加来源后，再选择如何学习。',
                    'Một thư viện. Thêm nguồn xong mới chọn cách học.',
                  )}
                </p>
              </aside>
              <section className={s.content}>
                <div className={`${s.row} ${s.between}`}>
                  <h2>
                    {source === 'file'
                      ? t('Add learning files', '把想学的文件放进来', 'Thêm tệp học tập')
                      : source === 'text'
                        ? t('Paste something worth practicing', '粘贴你想练习的内容', 'Dán nội dung đáng luyện')
                        : t('Learn from a link', '从链接导入材料', 'Học từ một liên kết')}
                  </h2>
                  <span className={s.pill}>{t('Auto-detect format', '自动识别格式', 'Tự nhận định dạng')}</span>
                </div>
                {source === 'file' ? (
                  <>
                    <div
                      data-testid="material-drop-zone"
                      className={`${s.drop} ${dragging ? s.dragging : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragging(true);
                      }}
                      onDragLeave={() => setDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragging(false);
                        if (!busy) choose(Array.from(e.dataTransfer.files));
                      }}
                    >
                      <Upload size={32} />
                      <strong>
                        {t(
                          'Drop files here, or choose files',
                          '拖入文件，或点击选择',
                          'Thả tệp vào đây, hoặc chọn tệp',
                        )}
                      </strong>
                      <span className={s.muted}>
                        {t(
                          'Books, vocabulary, documents, subtitles, video & audio',
                          '书籍、词表、文档、字幕、音视频',
                          'Sách, từ vựng, tài liệu, phụ đề, video & audio',
                        )}
                      </span>
                      <button className={s.primary} onClick={() => fileInput.current?.click()} disabled={busy}>
                        {t('Choose files', '选择文件', 'Chọn tệp')}
                      </button>
                      <span className={`${s.small} ${s.muted}`}>
                        {t('You can select multiple files', '支持多选文件', 'Bạn có thể chọn nhiều tệp')}
                      </span>
                    </div>
                    <input
                      className={s.hidden}
                      ref={fileInput}
                      type="file"
                      data-testid="durable-import-file"
                      multiple
                      accept=".txt,.md,.text,.pdf,.docx,.epub,.csv,.tsv,.srt,.vtt,.mp3,.wav,.m4a,.ogg,.flac,.mp4,.webm,.avi"
                      onChange={(e) => {
                        choose(Array.from(e.target.files || []));
                        e.target.value = '';
                      }}
                    />
                    <div className={s.filetypes}>
                      {[
                        [
                          t('Documents & English books', '文档与英文书籍', 'Tài liệu & sách tiếng Anh'),
                          'TXT · MD · PDF · DOCX · EPUB / 20 MB',
                        ],
                        [
                          t('Vocabulary & subtitles', '词书与字幕', 'Từ vựng & phụ đề'),
                          'CSV · TSV / 20 MB　SRT · VTT / 10 MB',
                        ],
                        [
                          t('Video & audio sources', '视频与音频来源', 'Nguồn video & audio'),
                          'MP4 · WebM · AVI · MP3 · WAV / 25 MB',
                        ],
                        [
                          t('Extended support · planned', '扩展支持 · 规划', 'Hỗ trợ mở rộng · dự kiến'),
                          'XLSX · JSON · OCR',
                        ],
                      ].map(([name, desc]) => (
                        <div key={name}>
                          <b>{name}</b>
                          {desc}
                        </div>
                      ))}
                    </div>
                    <a className={s.ghost} href="/templates/flashday-wordbook-template.csv" download>
                      {t('Download word book template', '下载词书模板', 'Tải mẫu sổ từ')}
                    </a>
                    <div className={s.queue}>
                      {files.map((file, i) => (
                        <div className={s.item} key={`${file.name}-${i}`}>
                          <div className={s.fileIcon}>{file.name.split('.').pop()?.toUpperCase()}</div>
                          <div className={s.info}>
                            <strong>{file.name}</strong>
                            <p className={`${s.small} ${s.muted}`}>{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                          </div>
                          <button
                            aria-label={`${t('Remove', '移除', 'Xoá')} ${file.name}`}
                            onClick={() => setFiles(files.filter((_, j) => j !== i))}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                ) : source === 'text' ? (
                  <>
                    <p className={s.muted}>
                      {t(
                        'Keep paragraphs, speaker names and punctuation. Review before saving.',
                        '保留段落、说话人与标点，保存前可以校对。',
                        'Giữ đoạn văn, tên vai nói và dấu câu. Rà soát trước khi lưu.',
                      )}
                    </p>
                    <textarea
                      aria-label={t('Your text', '原文', 'Văn bản của bạn')}
                      value={text}
                      disabled={!draft.ready || busy}
                      onChange={(e) => setText(e.target.value)}
                      placeholder={t(
                        'Paste an article, conversation, sentences or CSV vocabulary…',
                        '粘贴文章、对话、句子或 CSV 词表…',
                        'Dán bài viết, hội thoại, câu hoặc từ vựng CSV…',
                      )}
                    />
                    <p className={`${s.small} ${s.muted}`}>
                      {text.length} {t('characters', '字符', 'ký tự')}
                    </p>
                  </>
                ) : (
                  <div className={s.stack}>
                    <p className={s.muted}>
                      {t(
                        'Paste a web article or video link. We will try to extract its text or captions.',
                        '粘贴网页文章或视频链接，尝试提取正文或字幕。',
                        'Dán link bài viết web hoặc video. Chúng tôi sẽ thử trích xuất văn bản hoặc phụ đề.',
                      )}
                    </p>
                    <input
                      type="url"
                      aria-label={t('Source URL', '来源网址', 'URL nguồn')}
                      placeholder="https://…"
                      value={p.url}
                      onChange={(e) => p.setUrl(e.target.value)}
                    />
                    <p className={s.notice}>
                      {t(
                        'If extraction fails, you can add text or subtitles to the same task.',
                        '如果提取失败，可以在原任务补充文本或字幕，不会丢失来源。',
                        'Nếu trích xuất lỗi, bạn có thể thêm văn bản hoặc phụ đề vào cùng tác vụ.',
                      )}
                    </p>
                  </div>
                )}
                {(p.error || draft.error) && (
                  <p role="alert" className={s.error}>
                    {p.error || draft.error}
                  </p>
                )}
              </section>
            </div>
          )}
          {step === 1 && (
            <section className={s.processing}>
              <div className={`${s.row} ${s.between}`}>
                <h2>
                  {selected?.status === 'failed'
                    ? t(
                        'This material needs a little help',
                        '这份材料需要你补充一下',
                        'Tài liệu này cần bạn bổ sung chút',
                      )
                    : busy
                      ? t('Preparing your learning content', '正在准备学习内容', 'Đang chuẩn bị nội dung học')
                      : t('Your import queue', '材料处理队列', 'Hàng đợi nhập của bạn')}
                </h2>
                <span className={s.pill}>
                  {completed} / {currentJobs.length} {t('ready', '已完成', 'sẵn sàng')}
                </span>
              </div>
              <p className={s.muted}>
                {t(
                  'Files are handled independently. Review the ones that are ready.',
                  '各文件独立处理，完成的材料可以先开始校对。',
                  'Mỗi tệp xử lý độc lập. Tệp xong trước có thể rà soát ngay.',
                )}
              </p>
              <div className={s.progress}>
                <span style={{ width: `${currentJobs.length ? (completed / currentJobs.length) * 100 : 0}%` }} />
              </div>
              {currentJobs.map(queueRow)}
              {busy && (
                <p role="status" className={s.notice}>
                  {p.stage || t('Saving source…', '正在保存来源…', 'Đang lưu nguồn…')}
                </p>
              )}
              {(p.error || selected?.error || p.sourceWarning) && (
                <p role="alert" className={s.notice}>
                  {p.error || selected?.error || p.sourceWarning}
                </p>
              )}
              {selected?.kind === 'media' && selected.status !== 'ready' && (
                <div className={s.stack}>
                  <label className={s.stack}>
                    <span>
                      {t(
                        'Speech provider for this import',
                        '本次语音转写服务商',
                        'Nhà cung cấp speech cho lần nhập này',
                      )}
                    </span>
                    <select
                      className={s.outline}
                      disabled={busy}
                      value={speechProviderId}
                      onChange={(event) =>
                        setSpeechProviderOverrides((current) => ({
                          ...current,
                          [selected.id]: event.target.value as ProviderId,
                        }))
                      }
                    >
                      {speechProviders.map((id) => (
                        <option value={id} key={id}>
                          {id === 'openrouter' ? 'OpenRouter' : id === 'openai' ? 'OpenAI' : 'Groq'}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className={s.notice}>
                    {t(
                      'Your file is sent only to the provider selected here and may use paid quota. If it fails, choose another provider and retry; the original stays on this device.',
                      '文件只会发送给这里选择的服务商，可能使用付费额度。失败后可更换服务商重试，原文件仍保留在本机。',
                      'Tệp chỉ gửi tới nhà cung cấp bạn chọn ở đây và có thể trừ quota trả phí. Nếu lỗi, đổi nhà cung cấp rồi thử lại; bản gốc vẫn trên thiết bị.',
                    )}
                  </p>
                </div>
              )}
              {selected && (
                <div className={s.row} style={{ flexWrap: 'wrap', marginTop: 18 }}>
                  {selected.kind === 'media' && (p.error || selected.error) && (
                    <Link href="/settings" className={s.outline}>
                      {t('Check AI settings', '检查 AI 设置', 'Kiểm tra cài đặt AI')}
                    </Link>
                  )}
                  {['failed', 'cancelled', 'queued'].includes(selected.status) && (
                    <button
                      className={s.outline}
                      disabled={busy}
                      data-testid="import-process"
                      onClick={() => void p.process(selected.kind === 'media' ? speechProviderId : undefined)}
                    >
                      {selected.kind === 'media'
                        ? t('Confirm AI transcription', '确认 AI 转写', 'Xác nhận phiên âm AI')
                        : t('Retry / process', '重试 / 处理', 'Thử lại / xử lý')}
                    </button>
                  )}
                  {selected.status !== 'ready' && (
                    <>
                      <button className={s.outline} disabled={busy} onClick={() => setRecover(!recover)}>
                        {t('Add text', '补充文本', 'Thêm văn bản')}
                      </button>
                      {(selected.kind === 'media' || selected.kind === 'url') && (
                        <button className={s.outline} disabled={busy} onClick={() => subtitles.current?.click()}>
                          {t('Add SRT / VTT', '添加 SRT / VTT', 'Thêm SRT / VTT')}
                        </button>
                      )}
                    </>
                  )}
                  {busy && (
                    <button onClick={() => void p.cancel()}>
                      {t('Cancel task (keep original)', '取消任务（保留原文件）', 'Huỷ tác vụ (giữ bản gốc)')}
                    </button>
                  )}
                </div>
              )}
              {recover && (
                <div className={s.stack} style={{ marginTop: 16 }}>
                  <textarea
                    aria-label="Supplemental text"
                    value={p.supplement}
                    onChange={(e) => p.setSupplement(e.target.value)}
                    rows={6}
                  />
                  <button
                    disabled={busy || !p.supplement.trim()}
                    onClick={async () => {
                      await p.attachText();
                      setRecover(false);
                      setStep(2);
                    }}
                  >
                    {t('Use this text', '使用这段文本', 'Dùng văn bản này')}
                  </button>
                </div>
              )}
              <p className={`${s.small} ${s.muted}`} style={{ marginTop: 28 }}>
                {t(
                  'Originals remain on this device. Keep this page open while processing; interrupted tasks can be resumed.',
                  '原始文件保留在本机。处理期间请保持页面打开，中断后可恢复任务。',
                  'Bản gốc giữ trên thiết bị này. Giữ trang mở trong lúc xử lý; tác vụ gián đoạn có thể tiếp tục.',
                )}
              </p>
            </section>
          )}
          {step === 2 && selected && (
            <div className={s.review} data-testid="v2-review-workspace">
              <MaterialReviewV2 job={selected} disabled={busy} onChange={(job) => p.setSelected(job)} />
              <aside className={s.properties}>
                <h3>{t('Organize material', '整理材料', 'Sắp xếp tài liệu')}</h3>
                <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
                  <label>
                    {t('Title', '标题', 'Tiêu đề')}
                    <input
                      aria-label="Material title"
                      value={selected.title}
                      onChange={(e) => p.setSelected({ ...selected, title: e.target.value })}
                    />
                  </label>
                  <div className={s.stack}>
                    <label>
                      {t('Material type', '材料类型', 'Kiểu tài liệu')}
                      <select
                        aria-label="Material type"
                        value={type}
                        onChange={(e) => {
                          const next = e.target.value as ImportJob['materialType'];
                          if (
                            window.confirm(
                              t(
                                'Change the learning format? The original source will be kept.',
                                '切换学习形式？原始材料将保留。',
                                'Đổi định dạng học? Nguồn gốc vẫn được giữ.',
                              ),
                            )
                          )
                            p.setSelected({
                              ...selected,
                              materialType: next,
                              scenario:
                                next === 'scenario'
                                  ? selected.scenario || {
                                      situation: selected.blocks.map((b) => b.text).join('\n'),
                                      role: 'Learner',
                                      goal: '',
                                    }
                                  : selected.scenario,
                            });
                        }}
                      >
                        {MATERIAL_TYPES.map((kind) => (
                          <option
                            key={kind}
                            value={kind}
                            disabled={kind === 'video' && selected.kind !== 'media' && selected.kind !== 'url'}
                          >
                            {pick(MATERIAL_LABELS[kind])}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t('Difficulty', '难度', 'Độ khó')}
                      <select
                        value={selected.difficulty || 'intermediate'}
                        onChange={(e) =>
                          p.setSelected({ ...selected, difficulty: e.target.value as ImportJob['difficulty'] })
                        }
                      >
                        {[
                          ['beginner', t('Beginner · A1–A2', '初级 · A1–A2', 'Cơ bản · A1–A2')],
                          ['intermediate', t('Intermediate · B1–B2', '中级 · B1–B2', 'Trung bình · B1–B2')],
                          ['advanced', t('Advanced · C1–C2', '高级 · C1–C2', 'Nâng cao · C1–C2')],
                        ].map(([v, label]) => (
                          <option key={v} value={v}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    {t('Tags', '标签', 'Thẻ')}
                    <div className={s.tags}>
                      {tags.map((tag) => (
                        <button
                          key={tag}
                          className={s.tag}
                          aria-label={`Remove tag ${tag}`}
                          onClick={() => changeTags(tags.filter((a) => a !== tag))}
                        >
                          {tag} ×
                        </button>
                      ))}
                    </div>
                    <input
                      aria-label="Add tag"
                      value={tagText}
                      placeholder={t(
                        'Type a tag, then press Enter',
                        '输入标签，按 Enter 添加',
                        'Nhập thẻ rồi nhấn Enter',
                      )}
                      onChange={(e) => setTagText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      onBlur={flushTag}
                    />
                  </label>
                  <p className={`${s.small} ${s.muted}`}>{t('Common tags', '常用标签', 'Thẻ thường dùng')}</p>
                  <div className={s.tags}>
                    {[t('work', '职场', 'công việc'), t('travel', '旅行', 'du lịch')].map((tag) => (
                      <button
                        key={tag}
                        className={tags.includes(tag) ? s.tag : s.outline}
                        onClick={() => changeTags(tags.includes(tag) ? tags.filter((a) => a !== tag) : [...tags, tag])}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  <details>
                    <summary>{t('Source & more settings', '来源与更多设置', 'Nguồn & cài đặt thêm')}</summary>
                    <p>{selected.filename || selected.sourceUrl}</p>
                    {selected.sourceUrl && (
                      <a className={s.ghost} href={selected.sourceUrl} target="_blank" rel="noreferrer">
                        {t('Open source', '打开来源', 'Mở nguồn')}
                      </a>
                    )}
                    <p>
                      {t(
                        'Original text, chapters and timestamps are retained.',
                        '保留原文、章节与字幕时间。',
                        'Văn bản gốc, chương và mốc thời gian được giữ.',
                      )}
                    </p>
                    {selected.blocks.some((block) => block.timeStart !== undefined) && (
                      <label>
                        {t('Subtitle offset (seconds)', '字幕偏移（秒）', 'Lệch phụ đề (giây)')}
                        <input
                          type="number"
                          step="0.1"
                          value={selected.subtitleOffset || 0}
                          onChange={(event) => p.shiftSubtitles(Number(event.target.value))}
                        />
                      </label>
                    )}
                    {selected.originalFile && (
                      <button
                        className={s.ghost}
                        onClick={() => {
                          const url = URL.createObjectURL(selected.originalFile!);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = selected.filename || 'original';
                          a.click();
                          setTimeout(() => URL.revokeObjectURL(url), 1000);
                        }}
                      >
                        {t('Download original', '下载原文件', 'Tải bản gốc')}
                      </button>
                    )}
                  </details>
                </fieldset>
                {selected.requiresAudioStructure && !selected.audioStructured && (
                  <div className={s.notice}>
                    <p>
                      {t(
                        'Your reviewed sentences are ready to practice. Optionally ask AI to organize them or create a scenario.',
                        '校对后的句子可以直接开始练习，也可选择让 AI 整理或生成场景。',
                        'Câu đã rà soát sẵn sàng để luyện. Có thể nhờ AI sắp xếp hoặc tạo tình huống.',
                      )}
                    </p>
                    <button disabled={busy} onClick={() => void p.organizeAudio()}>
                      {t('Confirm AI organization', '确认 AI 整理', 'Xác nhận AI sắp xếp')}
                    </button>
                  </div>
                )}
                {p.error && (
                  <div className={s.error}>
                    <p role="alert">{p.error}</p>
                    {p.error.includes('changed in another window') && (
                      <button className={s.outline} disabled={busy} onClick={() => void p.reloadSaved()}>
                        {t(
                          'Reload saved version (discard unsaved edits)',
                          '重新加载已保存版本（放弃未保存修改）',
                          'Nạp lại bản đã lưu (bỏ phần sửa chưa lưu)',
                        )}
                      </button>
                    )}
                  </div>
                )}
              </aside>
            </div>
          )}
          {step === 3 && selected && (
            <section className={s.done} data-testid="import-ready">
              <div className={s.seal}>
                <Check size={25} />
              </div>
              <h2>
                {t(
                  'Your material is ready. Let’s practice.',
                  '材料准备好了，开始练习吧',
                  'Tài liệu đã sẵn sàng. Luyện thôi.',
                )}
              </h2>
              <p className={s.muted} style={{ marginTop: 9 }}>
                {t(
                  'Content, tags and source are saved together.',
                  '正文、标签与来源一起保存。',
                  'Nội dung, thẻ và nguồn được lưu cùng nhau.',
                )}
              </p>
              <div className={s.course}>
                <span className={s.pill}>{pick(MATERIAL_LABELS[type])}</span>
                <h2 style={{ marginTop: 12 }}>{selected.title}</h2>
                <p className={s.muted}>
                  {includedImportBlocks(selected).length}{' '}
                  {t(
                    'reviewed sections · ready for your first lesson',
                    '个已校对章节 · 可以开始第一课',
                    'đoạn đã rà soát · sẵn sàng bài đầu tiên',
                  )}
                </p>
                <div className={s.flow}>
                  {(type === 'wordbook'
                    ? [
                        t('Recall', '回忆释义', 'Nhớ nghĩa'),
                        t('Spell', '拼写', 'Chính tả'),
                        t('Use in context', '语境运用', 'Dùng trong ngữ cảnh'),
                        t('Review', '间隔复习', 'Ôn tập'),
                      ]
                    : [
                        t('Understand', '理解', 'Hiểu'),
                        t('Output', '输出', 'Tự viết'),
                        t('Correct', '纠错', 'Chữa'),
                        t('Review', '复习', 'Ôn tập'),
                        t('Apply', '运用', 'Vận dụng'),
                      ]
                  ).map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>
              </div>
              <label className={s.row} style={{ marginTop: 20 }}>
                <input
                  type="checkbox"
                  style={{ width: 18 }}
                  checked={scheduled}
                  disabled={scheduled || scheduling}
                  onChange={async () => {
                    setScheduling(true);
                    try {
                      await scheduleImportedMaterial(selected.materialIds || []);
                      setScheduled(true);
                    } catch (error) {
                      setScheduleError(error instanceof Error ? error.message : 'Could not add task');
                    } finally {
                      setScheduling(false);
                    }
                  }}
                />
                {scheduled
                  ? t('Added to today’s plan', '已加入今日计划', 'Đã thêm vào kế hoạch hôm nay')
                  : t('Add to today’s plan · optional', '加入今日计划 · 可选', 'Thêm vào kế hoạch hôm nay · tuỳ chọn')}
              </label>
              {scheduleError && (
                <p role="alert" className={s.error}>
                  {scheduleError}
                </p>
              )}
              <p className={`${s.small} ${s.muted}`} style={{ marginTop: 15 }}>
                {t(
                  'Unfinished imports remain in your queue for later.',
                  '未完成的导入任务保留在队列中，稍后可继续处理。',
                  'Nhập dở vẫn nằm trong hàng đợi để làm sau.',
                )}
              </p>
              <details open={requestedBlock !== null} className={s.notice}>
                <summary>{t('View source passages', '查看材料原文', 'Xem đoạn nguồn')}</summary>
                <section id="source-transcript" aria-label={t('Source locations', '原文位置', 'Vị trí trong nguồn')}>
                  {selected.blocks
                    .filter(
                      (block) => !requestedBlock || requestedBlock === 'transcript' || block.id === requestedBlock,
                    )
                    .map((block) => (
                      <div key={block.id} id={`source-${block.id}`}>
                        <h3>{block.title}</h3>
                        <p style={{ whiteSpace: 'pre-wrap' }}>{block.text}</p>
                        <details>
                          <summary>{t('Original source', '原始版本', 'Bản gốc')}</summary>
                          <p style={{ whiteSpace: 'pre-wrap' }}>
                            {selected.originalBlocks?.find((original) => original.id === block.id)?.text ||
                              selected.originalText?.slice(block.start, block.end)}
                          </p>
                        </details>
                      </div>
                    ))}
                </section>
              </details>
            </section>
          )}
        </div>
        <footer className={s.footer} data-testid="import-action-bar">
          <span className={`${s.small} ${s.muted}`}>
            {step === 0
              ? t(
                  'Format and size checked before processing',
                  '格式与大小在开始处理前检查',
                  'Định dạng và dung lượng được kiểm tra trước khi xử lý',
                )
              : step === 2
                ? p.draftStatus === 'saved'
                  ? t('✓ Draft saved', '✓ 草稿已保存', '✓ Đã lưu nháp')
                  : t('Saving draft…', '正在保存草稿…', 'Đang lưu nháp…')
                : step === 3
                  ? t('Only reviewed content is published', '只发布已确认的内容', 'Chỉ xuất bản nội dung đã rà soát')
                  : t('Keep this page open while processing', '处理期间请保持页面打开', 'Giữ trang mở trong lúc xử lý')}
          </span>
          <div className={`${s.actions} ${step === 2 && isAudio ? s.audioActions : ''}`}>
            {step === 0 ? (
              <>
                <button
                  className={s.ghost}
                  disabled={busy || !p.jobs.length}
                  onClick={() => {
                    p.setActiveIds([]);
                    p.setSelected(null);
                    setStep(1);
                  }}
                >
                  {t('Resume imports', '恢复导入', 'Tiếp tục nhập')}
                </button>
                <button
                  className={s.primary}
                  disabled={
                    busy ||
                    (source === 'file'
                      ? !files.length
                      : source === 'text'
                        ? !text.trim() || !draft.ready
                        : !p.url.trim())
                  }
                  onClick={() => void start()}
                  aria-label={
                    source === 'text'
                      ? t('Review content', '校对内容', 'Rà soát nội dung')
                      : t('Start processing', '开始处理', 'Bắt đầu xử lý')
                  }
                >
                  {source === 'text'
                    ? t('Review content', '校对内容', 'Rà soát nội dung')
                    : t('Start processing', '开始处理', 'Bắt đầu xử lý')}{' '}
                  →
                </button>
              </>
            ) : step === 1 ? (
              <>
                <button className={s.ghost} disabled={busy} onClick={() => setStep(0)}>
                  {t('Back to source', '返回来源', 'Về nguồn')}
                </button>
                <button
                  className={s.primary}
                  disabled={busy || !currentJobs.some((j) => j.status === 'needsReview')}
                  onClick={() => void openJob(currentJobs.find((j) => j.status === 'needsReview')!)}
                >
                  {t('Review ready material', '校对已完成材料', 'Rà soát tài liệu sẵn sàng')} →
                </button>
              </>
            ) : step === 2 ? (
              <>
                <button
                  className={s.ghost}
                  disabled={busy}
                  onClick={async () => {
                    await p.save();
                    setStep(0);
                  }}
                >
                  {t('Back to source', '返回来源', 'Về nguồn')}
                </button>
                <button
                  className={isAudio ? s.outline : s.primary}
                  data-testid="import-publish"
                  aria-label={t('Add to library', '加入资料库', 'Thêm vào thư viện')}
                  disabled={busy || !valid}
                  onClick={() => void publish()}
                >
                  {busy
                    ? t('Saving…', '正在保存…', 'Đang lưu…')
                    : t('Add to library', '加入资料库', 'Thêm vào thư viện')}{' '}
                  →
                </button>
                {isAudio && (
                  <button className={s.primary} disabled={busy || !valid} onClick={() => void publish(true)}>
                    {t('Save & start practicing', '保存并开始练习', 'Lưu & bắt đầu luyện')}
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  className={s.ghost}
                  onClick={() => {
                    setFiles([]);
                    p.setSelected(null);
                    p.setActiveIds([]);
                    setStep(0);
                  }}
                >
                  {t('Continue adding', '继续添加', 'Tiếp tục thêm')}
                </button>
                {p.publishedSource && (
                  <Link
                    className={s.primary}
                    aria-label={t('Start first lesson', '开始第一课', 'Bắt đầu bài đầu tiên')}
                    href={`/learn/${encodeURIComponent(unitIdForContent(p.publishedSource))}`}
                  >
                    {t('Start first lesson', '开始第一课', 'Bắt đầu bài đầu tiên')} →
                  </Link>
                )}
              </>
            )}
          </div>
        </footer>
        <input
          type="file"
          className={s.hidden}
          ref={subtitles}
          accept=".srt,.vtt"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) {
              await p.attachSubtitles(file);
              setStep(2);
            }
            e.target.value = '';
          }}
        />
      </div>
    </dialog>
  );
}
