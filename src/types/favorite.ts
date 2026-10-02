import type { FSRSCardData } from '@/types/content';

export interface RelatedData {
  synonyms?: string[];
  wordFamily?: { word: string; pos: string }[];
  relatedPhrases?: string[];
  keyVocabulary?: { word: string; translation: string }[];
}

export type FavoriteType = 'word' | 'phrase' | 'sentence';
export type FavoriteSourceModule = 'listen' | 'read' | 'write' | 'speak' | 'library' | 'chat' | 'journal';

export interface FavoriteItem {
  id: string;
  text: string;
  normalizedText: string;
  translation: string;
  type: FavoriteType;
  folderId: string;
  sourceContentId?: string;
  sourceModule?: FavoriteSourceModule;
  context?: string;
  targetLang: string;
  pronunciation?: string;
  notes?: string;
  related?: RelatedData;
  fsrsCard?: FSRSCardData;
  nextReview?: number;
  autoCollected: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface FavoriteFolder {
  updatedAt?: number;
  id: string;
  name: string;
  emoji: string;
  color?: string;
  sortOrder: number;
  createdAt: number;
}

export interface LookupEntry {
  text: string;
  count: number;
  lastLookedUp: number;
}

export type AutoCollectSensitivity = 'low' | 'medium' | 'high';

export interface AutoCollectSettings {
  enabled: boolean;
  sensitivity: AutoCollectSensitivity;
  dailyCap: number;
}

export const DEFAULT_FOLDERS: FavoriteFolder[] = [
  { id: 'default', name: '默认收藏', emoji: '⭐', sortOrder: 0, createdAt: 0 },
  { id: 'auto', name: '智能收藏', emoji: '🤖', sortOrder: 1, createdAt: 0 },
];

export type ReservedFolderId = 'default' | 'auto';

export function isReservedFolderId(id: string): id is ReservedFolderId {
  return id === 'default' || id === 'auto';
}

interface FolderLabelMessages {
  defaultFolderName: string;
  smartFolderName: string;
}

/**
 * Reserved folders keep semantic identity by id ('default' | 'auto'); their
 * stored `name` is legacy seed data, so display labels resolve through i18n
 * at render time. User-authored folder names render unchanged.
 */
export function favoriteFolderDisplayName(
  folder: Pick<FavoriteFolder, 'id' | 'name'>,
  messages: FolderLabelMessages,
): string {
  if (folder.id === 'default') return messages.defaultFolderName;
  if (folder.id === 'auto') return messages.smartFolderName;
  return folder.name;
}

export const SENSITIVITY_THRESHOLDS = {
  low: { writeErrorRate: 0.7, fsrsAgainCount: 3, lookupCount: 5 },
  medium: { writeErrorRate: 0.5, fsrsAgainCount: 2, lookupCount: 3 },
  high: { writeErrorRate: 0.3, fsrsAgainCount: 1, lookupCount: 2 },
} as const;
