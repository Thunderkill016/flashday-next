/*
 * Research manifest (Part 25) — citable principles backing curriculum
 * decisions. Superset of the FD-CONTENT-01 registry; ids are stable so
 * coverage reports and validators resolve them.
 */
import type { ResearchEntry } from './types.ts';

export const RESEARCH_MANIFEST: Record<string, ResearchEntry> = {
  /* ---- carried from foundation-v1 ---- */
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
    principle: 'function-first target selection for functional tracks',
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
    principle: 'conservative A0-B1 labels; descriptors inform tasks not order',
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

  /* ---- new for the factory ---- */
  'curriculum-graph': {
    id: 'curriculum-graph',
    name: 'Prerequisite vs sequence distinction',
    where: 'factory design decision — DAG discipline',
    principle: 'only structural blockers are prerequisites; teaching order is recommendation, never graph truth',
  },
  'recycling-strand': {
    id: 'recycling-strand',
    name: 'Nation: spaced recycling inside meaning-focused strands',
    where: 'four-strands + A0 dossier recycling guidance',
    principle:
      'introduced -> practiced -> retrieved -> recycled -> transferred stages tracked, never equated with mastery',
  },
  'vn-final-consonants': {
    id: 'vn-final-consonants',
    name: 'VN syllable structure drops final consonants',
    where: 'phonetic contrast DB + BUILDING_FOR_VIETNAMESE_LEARNERS.md',
    principle: 'word-final /t d s z k p/ perception prioritized; codas never assumed',
  },
  'vn-stress-timing': {
    id: 'vn-stress-timing',
    name: 'VN syllable-timed rhythm vs English stress-timing',
    where: 'BUILDING_FOR_VIETNAMESE_LEARNERS.md + phonology notes',
    principle: 'equal-weight syllables miss content-word signal; stress-hunting is a decoding skill',
  },
  'dev-english-tasks': {
    id: 'dev-english-tasks',
    name: 'Developer English is task-structured, not grammar-structured',
    where: 'NEP deep-research developer sources + community corpus',
    principle: 'authentic task frames (status/bug/PR/incident/handoff) drive lesson design',
  },
  'listening-first-decoding': {
    id: 'listening-first-decoding',
    name: 'Decoding precedes meaning for low-level listeners',
    where: 'lakehouse dim_listening_microskills tiers + Goh & Vandergrift',
    principle: 'bottom-up boundary/stress/reduction trained before inference tasks',
  },
};
