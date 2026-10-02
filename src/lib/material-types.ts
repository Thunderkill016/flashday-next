import { getWordBook } from '@/lib/wordbooks';
import type { BookItem, CollectionItem, ContentItem, MaterialType } from '@/types/content';

export const MATERIAL_TYPES: MaterialType[] = ['wordbook', 'video', 'reading', 'dialogue', 'sentences', 'scenario'];
export const MATERIAL_LABELS: Record<MaterialType, { en: string; zh: string; vi: string }> = {
  wordbook: { en: 'Word books', zh: '词书', vi: 'Sổ từ' },
  video: { en: 'Videos', zh: '视频', vi: 'Video' },
  reading: { en: 'Reading · Books', zh: '阅读 · 英文书籍', vi: 'Đọc · Sách tiếng Anh' },
  dialogue: { en: 'Dialogues', zh: '对话', vi: 'Hội thoại' },
  sentences: { en: 'Sentences', zh: '句集', vi: 'Bộ câu' },
  scenario: { en: 'Scenarios', zh: '场景', vi: 'Tình huống' },
};

export function classifyMaterial(sources: ContentItem[], book?: BookItem, collection?: CollectionItem): MaterialType {
  const explicit = sources.find((s) => s.metadata?.materialType)?.metadata?.materialType;
  if (explicit && MATERIAL_TYPES.includes(explicit)) return explicit;
  if (sources.some((source) => source.category === 'everyday-scenarios')) return 'scenario';
  if (sources.every((s) => s.type === 'word')) return 'wordbook';
  if (collection?.scenario) return 'scenario';
  if (sources[0]?.category && getWordBook(sources[0].category)?.kind === 'scenario') return 'scenario';
  if (book) return 'reading';
  const first = sources[0];
  const metadata = first?.metadata;
  if (
    metadata?.mediaKind === 'video' ||
    /\.(mp4|webm|mov|avi|mkv)$/i.test(metadata?.sourceFilename ?? '') ||
    /(?:youtube\.com|youtu\.be)/i.test(metadata?.sourceUrl ?? '')
  )
    return 'video';
  if (
    metadata?.mediaKind === 'audio' ||
    metadata?.audioUrl ||
    /\.(mp3|wav|m4a|ogg|flac)$/i.test(metadata?.sourceFilename ?? '')
  )
    return 'sentences';
  if (sources.every((s) => s.type === 'word' || s.type === 'phrase')) return 'wordbook';
  if (sources.every((s) => s.type === 'sentence' || s.type === 'phrase')) return 'sentences';
  if (first && first.text.split('\n').filter((line) => /^[\w .'-]{1,30}:\s+\S/.test(line)).length >= 2)
    return 'dialogue';
  return 'reading';
}
