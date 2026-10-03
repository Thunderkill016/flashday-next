/*
 * Reference registries for flashday-foundation-v1.
 *
 * SOURCE_REFERENCES: materials in the saved corpus that informed lesson
 * language/topic/coverage, each classified by rights posture (the
 * ENGLISH_SOURCE_LIBRARY_V2 rights taxonomy + NEP provenance). The
 * validator rejects REJECTED sources on any lesson and requires derived
 * inputs to cite a reusable source.
 *
 * RESEARCH_REFERENCES: evidence/principles that informed instructional
 * design. Ids are stable so coverage docs and validators can check them.
 */

export type SourceClass = 'REUSABLE_CONTENT' | 'LINK_AND_DERIVE' | 'REFERENCE_ONLY' | 'REJECTED';

export interface SourceReference {
  id: string;
  klass: SourceClass;
  name: string;
  where: string;
  note: string;
}

export const SOURCE_REFERENCES: Record<string, SourceReference> = {
  'fd-authored': {
    id: 'fd-authored',
    klass: 'REUSABLE_CONTENT',
    name: 'Original FlashDay-authored lesson text',
    where: 'this repository',
    note: 'Dialogues and texts written for this pack; no upstream rights.',
  },
  'nep-speaking-functions': {
    id: 'nep-speaking-functions',
    klass: 'LINK_AND_DERIVE',
    name: 'NEP lakehouse dim_speaking_functions',
    where: 'NEP/05_UNIFIED_DATA_LAKEHOUSE/03_gold/marts/unified_english_lake.sqlite',
    note: 'A1-B1 speech-act inventory with sample phrasing; informed function selection.',
  },
  'nep-collocations': {
    id: 'nep-collocations',
    klass: 'LINK_AND_DERIVE',
    name: 'NEP lakehouse fact_phrasal_collocations',
    where: 'unified_english_lake.sqlite',
    note: 'Chunk/collocation candidates with Vietnamese glosses.',
  },
  'nep-dialogues': {
    id: 'nep-dialogues',
    klass: 'LINK_AND_DERIVE',
    name: 'NEP lakehouse fact_functional_dialogues',
    where: 'unified_english_lake.sqlite',
    note: 'Scenario/key-expression inventory; informed scenario choices, not text.',
  },
  'nep-grammar-errors': {
    id: 'nep-grammar-errors',
    klass: 'LINK_AND_DERIVE',
    name: 'NEP lakehouse fact_grammar_mastery (Vietnamese common mistakes)',
    where: 'unified_english_lake.sqlite',
    note: 'Per-topic VN error notes used to pick support targets.',
  },
  'nep-phonetic-db': {
    id: 'nep-phonetic-db',
    klass: 'LINK_AND_DERIVE',
    name: 'vietnamese_english_phonetic_contrast.json',
    where: 'NEP/02_CURRICULUM_AND_FRAMEWORKS/',
    note: '44-phoneme VN-EN contrast DB with minimal pairs; informed Track D targets.',
  },
  'nep-stage0': {
    id: 'nep-stage0',
    klass: 'LINK_AND_DERIVE',
    name: 'stage-0-curriculum.json',
    where: 'NEP/02_CURRICULUM_AND_FRAMEWORKS/stage_0_curriculum/',
    note: 'Unit schema precedent (canDo + cloze/sentence_builder activity types).',
  },
  'nep-painpoints': {
    id: 'nep-painpoints',
    klass: 'LINK_AND_DERIVE',
    name: 'NEP lakehouse fact_learner_painpoints (10.5k community posts)',
    where: 'unified_english_lake.sqlite',
    note: 'Needs-analysis signal: speaking/listening/grammar dominate VN learner complaints.',
  },
  'oxford-5000': {
    id: 'oxford-5000',
    klass: 'LINK_AND_DERIVE',
    name: 'oxford_5000_full.json',
    where: 'NEP/02_CURRICULUM_AND_FRAMEWORKS/vocab_databases/',
    note: 'CEFR level + IPA per headword; used as difficulty prior only, text not copied.',
  },
  'cefr-can-do': {
    id: 'cefr-can-do',
    klass: 'REFERENCE_ONLY',
    name: 'CEFR Companion Volume + lakehouse fact_cefr_can_do',
    where: 'coe.int; unified_english_lake.sqlite',
    note: 'Descriptors inform conservative level labels; not a teaching order.',
  },
  'english-for-it': {
    id: 'english-for-it',
    klass: 'REFERENCE_ONLY',
    name: 'Oxford English for Information Technology + IT-English guides (corpus)',
    where: 'NEP/03_.../learning_markdown_guides/*CNTT*',
    note: 'Informed Track E topic scope (bug reports, PRs, deploys); commercial, not copied.',
  },
  'community-guides': {
    id: 'community-guides',
    klass: 'REFERENCE_ONLY',
    name: 'Vietnamese community learning guides corpus',
    where: 'NEP/03_COMMUNITY_CORPUS_AND_DATASETS/learning_markdown_guides/',
    note: 'Topic expectations of VN learners; prose never embedded.',
  },
  'exam-prep': {
    id: 'exam-prep',
    klass: 'REFERENCE_ONLY',
    name: 'IELTS/TOEIC materials in corpus',
    where: 'NEP/03_.../ielts_toeic_master_collection/, practice_tests_and_exercise_banks/',
    note: 'Commercial exam content; informed exclusion — this pack is not test prep.',
  },
  'pirate-mirrors': {
    id: 'pirate-mirrors',
    klass: 'REJECTED',
    name: 'Pirated textbook mirrors (pdfcoffee/Scribd/Drive reposts)',
    where: 'various download URLs inside corpus catalogs',
    note: 'Never ingested. Listed so the validator has a denylist to enforce.',
  },
};

export interface ResearchReference {
  id: string;
  name: string;
  where: string;
  principle: string;
}

export const RESEARCH_REFERENCES: Record<string, ResearchReference> = {
  'lsrules-loop': {
    id: 'lsrules-loop',
    name: 'Minimum learning loop',
    where: 'NEP/01/learning_science_rules/LEARNING_SCIENCE_PRODUCT_RULES.md',
    principle: 'gist -> progressive support -> form retrieval -> changed-context transfer -> delayed retrieval',
  },
  'lsrules-captions': {
    id: 'lsrules-captions',
    name: 'Captions are support, not the task',
    where: 'LEARNING_SCIENCE_PRODUCT_RULES.md (Montero Perez et al. 2013, System)',
    principle: 'transcript/caption gated behind attempt; never default for retrieval',
  },
  'lsrules-retrieval': {
    id: 'lsrules-retrieval',
    name: 'Retrieval over restudy',
    where: 'LEARNING_SCIENCE_PRODUCT_RULES.md (Nakata 2017; Rice & Tokowicz 2020)',
    principle: 'a production/retrieval event is required for retrieval evidence',
  },
  'lsrules-transfer': {
    id: 'lsrules-transfer',
    name: 'Transfer changes context',
    where: 'LEARNING_SCIENCE_PRODUCT_RULES.md',
    principle: 'reuse a recalled target in a different situation; same-prompt repetition is not transfer',
  },
  'lsrules-spacing': {
    id: 'lsrules-spacing',
    name: 'Spacing is durable state, not a streak',
    where: 'LEARNING_SCIENCE_PRODUCT_RULES.md (Webb, Uchihara & Yanagisawa 2023)',
    principle: 'completion never displayed/persisted as mastery',
  },
  'lsrules-feedback': {
    id: 'lsrules-feedback',
    name: 'Prompts beat recasts; explicit now, implicit lasts',
    where: 'LEARNING_SCIENCE_PRODUCT_RULES.md (oral CF meta-analysis d=0.64)',
    principle: 'give the learner a chance to self-correct before supplying the form',
  },
  'lsrules-hvpt': {
    id: 'lsrules-hvpt',
    name: 'HVPT trains perception, not production',
    where: 'LEARNING_SCIENCE_PRODUCT_RULES.md (79-study meta-analysis g=0.67)',
    principle: 'perception training claimed for hearing only; no accent-erasure claims',
  },
  'lsrules-chunks': {
    id: 'lsrules-chunks',
    name: 'Formulaic sequences reduce pausing',
    where: 'LEARNING_SCIENCE_PRODUCT_RULES.md (beta=.40, R2=.16)',
    principle: 'chunks as first-class targets; the unit of recall is a sequence',
  },
  'vn-assembly': {
    id: 'vn-assembly',
    name: 'Assembly is the bottleneck; production is the spine',
    where: 'NEP/01/vietnamese_learner_linguistics/BUILDING_FOR_VIETNAMESE_LEARNERS.md',
    principle: 'sessions end in learner generation; silent-mode (typing) production is valid',
  },
  'vn-l1-support': {
    id: 'vn-l1-support',
    name: 'L1 glossing beats L2 glossing for beginners',
    where: 'BUILDING_FOR_VIETNAMESE_LEARNERS.md (78 effect sizes, 26 studies)',
    principle: 'Vietnamese used strategically for cues, meaning, feedback',
  },
  'vn-phonology': {
    id: 'vn-phonology',
    name: 'Vietnamese phonotactics -> predictable English error sites',
    where: 'BUILDING_FOR_VIETNAMESE_LEARNERS.md + phonetic contrast DB + CTU cluster study',
    principle: 'final consonants, clusters, /th/, tense-lax vowels prioritized',
  },
  'vn-grammar-errors': {
    id: 'vn-grammar-errors',
    name: 'Top VN error classes: articles, prepositions, tense/agreement',
    where: 'BUILDING_FOR_VIETNAMESE_LEARNERS.md + lakehouse fact_grammar_mastery',
    principle: 'grammar support chosen by measured VN difficulty, not topic order',
  },
  'env-30min': {
    id: 'env-30min',
    name: '30-minute daily budget; phone-first; often cannot speak aloud',
    where: 'NEP/01/vietnamese_learner_linguistics/LEARNER_AND_ENVIRONMENT.md',
    principle: 'small lesson inputs; typed production acceptable; no voice-only path',
  },
  'a0-evidence': {
    id: 'a0-evidence',
    name: 'Distinct evidence per capability',
    where: 'NEP/01/learning_science_rules/A0_ENGLISH_LEARNING_RESEARCH_DOSSIER.md',
    principle: 'understood/recalled/transferred/retained are separate claims',
  },
  'a0-contract': {
    id: 'a0-contract',
    name: 'A0 content contract',
    where: 'A0_ENGLISH_LEARNING_RESEARCH_DOSSIER.md section 6',
    principle: 'can-do + targets + support ladder + closed tasks + transfer variant + review spec',
  },
  'a0-four-strands': {
    id: 'a0-four-strands',
    name: 'Four strands balance',
    where: 'A0 dossier (Newton & Nation)',
    principle: 'input, output, language-focused learning, fluency all present across the pack',
  },
  'day28-support-scale': {
    id: 'day28-support-scale',
    name: 'P3->P0 prompt-support scale',
    where: 'NEP/02/28-day-speaking-journey-contract.md',
    principle: 'support fades toward situation-only performance; scale is per-lesson',
  },
  'esl2-rights': {
    id: 'esl2-rights',
    name: 'Fail-closed rights gate',
    where: 'ENGLISH_SOURCE_LIBRARY_V2/00_MANIFEST/RIGHTS_GATE.md',
    principle: 'RAW->REVIEWED->NORMALIZED->QA->APP_READY; reference-only never embedded',
  },
  'esl2-evidence-levels': {
    id: 'esl2-evidence-levels',
    name: 'Evidence levels per capability',
    where: 'ENGLISH_SOURCE_LIBRARY_V2 schema/CORE_SCHEMA_V2.md + ROADMAP Phase C',
    principle: 'exposure->recognition->cued recall->controlled production->contextual->transfer',
  },
  'esl2-cf-timing': {
    id: 'esl2-cf-timing',
    name: 'No universal feedback timing',
    where: 'SOURCE_INDEX learning_science (CF timing systematic review, PMC9995700)',
    principle: 'feedback timing conditioned on task/modality, not doctrine',
  },
  'esl2-ilh': {
    id: 'esl2-ilh',
    name: 'Involvement load hypothesis',
    where: 'SOURCE_INDEX (MDPI systematic review, 78 studies)',
    principle: 'deeper task involvement -> better vocabulary retention; need+search+evaluation',
  },
  'esl2-vocab-cards': {
    id: 'esl2-vocab-cards',
    name: 'Word cards build receptive, not productive, knowledge',
    where: 'SOURCE_INDEX (Frontiers 2022 word-card synthesis)',
    principle: 'recall cues go beyond card flipping; production tasks mandatory',
  },
  'lake-functions': {
    id: 'lake-functions',
    name: 'Speech-act function inventory A1-B1',
    where: 'lakehouse dim_speaking_functions',
    principle: 'function-first target selection for Tracks A/B',
  },
  'lake-microskills': {
    id: 'lake-microskills',
    name: 'Listening microskill tiers',
    where: 'lakehouse dim_listening_microskills',
    principle: 'bottom-up decoding separated from top-down comprehension',
  },
  'lake-cando': {
    id: 'lake-cando',
    name: 'CEFR can-do descriptors with GSE anchors',
    where: 'lakehouse fact_cefr_can_do',
    principle: 'conservative A1/A2 labels; descriptors inform tasks not order',
  },
  'lake-painpoints': {
    id: 'lake-painpoints',
    name: 'Community painpoint corpus as needs analysis',
    where: 'lakehouse fact_learner_painpoints (10,515 posts)',
    principle: 'speaking/listening/grammar dominate VN learner demand',
  },
  'sla-shadowing-vn': {
    id: 'sla-shadowing-vn',
    name: 'Video shadowing improves suprasegmentals (VN learners)',
    where: 'sla_research_papers/EJ1459868 (Can Tho University)',
    principle: 'listen-then-reuse rhythm; segmentals need separate treatment',
  },
  'sla-l1-transfer': {
    id: 'sla-l1-transfer',
    name: 'L1 negative transfer patterns in VN learners',
    where: 'sla_research_papers/EJ1440877 (rEFLections 2024)',
    principle: 'direct VN->EN translation produces unidiomatic output; chunks counter it',
  },
  'sla-lexical-threshold': {
    id: 'sla-lexical-threshold',
    name: 'Lexical coverage as probabilistic difficulty prior',
    where: 'sla_research_papers/EJ887873 (Laufer & Ravenhorst-Kalovski)',
    principle: 'low non-target load; no hard coverage gate',
  },
  'sla-final-consonants': {
    id: 'sla-final-consonants',
    name: 'Word-final consonant instruction works',
    where: 'sla_research_papers/ED476261 (Silveira 2002)',
    principle: 'final-consonant perception/production is trainable',
  },
  'sla-l2tv': {
    id: 'sla-l2tv',
    name: 'Incidental vocabulary through L2 viewing',
    where: 'sla_research_papers/W2790358757 (SSSA manuscript)',
    principle: 'repeated meaningful encounters; not a first-lesson mechanism',
  },
  'sla-gloss': {
    id: 'sla-gloss',
    name: 'Gloss format and cognitive load',
    where: 'sla_research_papers/W2592200162',
    principle: 'minimal glosses on demand, not walls of annotation',
  },
  'sla-extensive-reading': {
    id: 'sla-extensive-reading',
    name: 'Extensive reading has the largest vocab effect (d=1.32)',
    where: 'sla_research_papers/EJ1179114 + product rules correction',
    principle: 'deferred for pack design; reading inputs stay short and dense',
  },
  'oxford-5k-prior': {
    id: 'oxford-5k-prior',
    name: 'Oxford 5000 levels as difficulty prior',
    where: 'oxford_5000_full.json',
    principle: 'non-target words kept inside A1-A2 bands where possible',
  },
};

export const TRACKS: Record<string, { title: string; titleVi: string; description: string; descriptionVi: string }> = {
  a: {
    title: 'Essential Interaction',
    titleVi: 'Giao tiếp thiết yếu',
    description: 'Survival spoken functions: introduce yourself, ask for clarification, make requests.',
    descriptionVi: 'Các chức năng giao tiếp cơ bản nhất: giới thiệu, hỏi lại, yêu cầu.',
  },
  b: {
    title: 'Everyday Functional English',
    titleVi: 'Tiếng Anh đời thường',
    description: 'Routines, schedules, plans, problems, opinions for daily life and work.',
    descriptionVi: 'Thói quen, lịch trình, kế hoạch, vấn đề và ý kiến trong đời sống và công việc.',
  },
  c: {
    title: 'Useful Chunks',
    titleVi: 'Cụm ngôn ngữ hữu ích',
    description: 'High-utility formulaic sequences that remove assembly effort mid-speech.',
    descriptionVi: 'Các cụm câu mẫu giúp nói/viết trôi chảy mà không phải ghép từng từ.',
  },
  d: {
    title: 'Listening & Pronunciation',
    titleVi: 'Nghe & Phát âm',
    description: 'Hear word boundaries, reductions and chunks; perception before production.',
    descriptionVi: 'Nghe ranh giới từ, âm giảm và cụm nghĩa; nhận biết trước khi nói.',
  },
  e: {
    title: 'English for Developers',
    titleVi: 'Tiếng Anh cho lập trình viên',
    description: 'Work communication for software work: status, bugs, PRs, deploys.',
    descriptionVi: 'Giao tiếp công việc phần mềm: tiến độ, lỗi, pull request, deploy.',
  },
};
