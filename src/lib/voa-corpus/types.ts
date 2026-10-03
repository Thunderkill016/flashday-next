/*
 * FD-VOA-CORPUS-01 — VOA Learning English corpus types.
 *
 * Three lifecycle stages, kept separate per mission §11/§15/§51:
 *   VoaSourceRecord       — raw discovered+fetched resource (provenance + raw payload)
 *   VoaLearningResource   — normalized neutral model (learner-material candidate)
 *   LearningMediaAsset    — resolvable real-audio/video registry entry
 *
 * Rights are tracked per ASSET, never per domain (§12).
 */

export type VoaRightsStatus =
  | 'VOA_ORIGINAL_PUBLIC_DOMAIN'
  | 'MIXED_RIGHTS_REVIEW_REQUIRED'
  | 'THIRD_PARTY_RESTRICTED'
  | 'UNKNOWN';

export type VoaSeriesTier = 'A' | 'B' | 'C' | 'D';

export interface VoaAsset {
  url: string;
  kind: 'audio' | 'video' | 'image' | 'pdf';
  mimeType?: string;
  bytes?: number;
  label?: string; // e.g. 'hq', '720p', 'download'
}

export interface VoaSourceRecord {
  id: string; // voa:<contentId> or voa:url-hash
  canonicalUrl: string;
  series: string; // series manifest id
  title: string;
  publishedAt?: string;
  updatedAt?: string;

  levelHint?: string; // VOA's own level label — preserved, never trusted
  articleText?: string; // raw extracted body text
  transcript?: string;

  audio: VoaAsset[];
  video: VoaAsset[];
  images: VoaAsset[];
  documents: VoaAsset[]; // worksheets, lesson plans, PDFs

  sourceCredits: string[]; // detected credit/byline lines
  externalCredits: string[]; // non-VOA credits (AP, Reuters, Getty, ...)

  rightsStatus: VoaRightsStatus;
  rightsReasons: string[]; // why this status — audit trail

  discoveredFrom: string; // 'zone:/z/987?p=3' | 'page:/p/5644.html' | 'rss:3619'
  fetchedAt: string; // ISO
  contentHash: string; // sha256 of extracted payload
}

export type VoaResourceKind =
  | 'course_lesson'
  | 'grammar'
  | 'expression'
  | 'pronunciation'
  | 'article'
  | 'story'
  | 'podcast'
  | 'teacher_resource';

export type FlashDayLevel = 'a0' | 'a1' | 'a2' | 'b1' | 'b2';

export interface VoaLevelInfo {
  source?: string; // VOA's own label, preserved verbatim
  inferred?: FlashDayLevel;
  confidence: number; // 0..1
  basis?: string; // e.g. 'oxford-coverage a1=0.41 a2=0.72'
}

export interface VoaLinguisticEnrichment {
  // vocabulary (Oxford prior)
  knownHeadwords: number;
  outOfBandWords: string[];
  oxfordCoverage: Record<string, number>; // {A1: 0.42, ...}
  lexicalDensity: number; // content words / total words
  targetCandidates: string[]; // out-of-band + low-band words worth teaching

  // chunk candidates vs existing curriculum
  knownChunks: string[]; // chunks that match V2 targets/collocations (recycling)
  newChunks: string[]; // plausible chunks not in curriculum
  domainChunks: string[]; // topic-bound chunks

  // semantic mapping
  communicativeFunctions: string[]; // fn.NN ids
  capabilities: string[]; // FlashDay capability ids
  grammarFeatures: string[]; // grammar knowledge ids / feature names
  listeningFeatures: string[]; // microskill ids
  pronunciationFeatures: string[]; // phoneme/contrast ids

  topicTags: string[];
}

export interface VoaLearningResource {
  id: string;
  kind: VoaResourceKind;
  title: string;
  text: string; // normalized body (provenance-preserved: raw kept in source record)
  transcript?: string;

  audioRefs: string[]; // media asset ids
  videoRefs: string[];
  documentRefs: string[];

  series: string;
  level: VoaLevelInfo;
  enrichment: VoaLinguisticEnrichment;

  source: {
    publisher: 'Voice of America';
    canonicalUrl: string;
    publicDomainVerified: boolean;
    attribution: string; // 'Source: VOA Learning English — learningenglish.voanews.com'
    contentHash: string;
    sourceRevision: number;
  };

  pipelineState: 'RAW' | 'RIGHTS_VERIFIED' | 'NORMALIZED' | 'ENRICHED' | 'REVIEWED' | 'APP_READY';
}

export interface LearningMediaAsset {
  id: string; // voa-media:<hash>
  provider: 'voa';
  sourceResourceId: string;
  type: 'audio' | 'video';
  url: string;
  hash?: string; // content hash when downloaded
  durationMs?: number;
  mimeType?: string;
  rightsStatus: VoaRightsStatus;
  attribution: string;
  resolvable: boolean; // URL verified with HEAD request
}

export interface CurriculumLink {
  voaResourceId: string;
  kind: 'authentic-reencounter' | 'audio-candidate' | 'grammar-support' | 'chunk-recycling' | 'authoring-reference';
  lessonId?: string; // FlashDay lesson id
  targetId?: string; // FlashDay target id
  capabilityId?: string;
  matchedSurface: string; // what matched (chunk text, function, capability)
  level: FlashDayLevel | undefined;
  confidence: number;
}

export interface RecyclingMatch {
  gapChunk: string; // the uncovered V2 chunk text
  homeLesson: string;
  voaResourceId: string;
  voaTitle: string;
  occurrence: string; // the matching sentence/context
  level: FlashDayLevel | undefined;
  usable: boolean; // level-appropriate + rights-verified
}
