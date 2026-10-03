#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
/*
 * Knowledge-layer extractor (FD-CONTENT-FACTORY-01, Part 2).
 *
 * Reads the local NEP corpus (lakehouse sqlite + JSON artifacts) and
 * emits normalized KnowledgeEntry tables as generated TS files under
 * src/lib/content-factory/knowledge/. Deterministic: same corpus ->
 * same output (no timestamps in generated content).
 *
 * Usage: node scripts/extract-knowledge.mjs [corpusRoot]
 *   corpusRoot defaults to /home/thunder/Code/NEP
 */
import sqlite3 from 'node:sqlite';

const CORPUS = process.argv[2] ?? '/home/thunder/Code/NEP';
const OUT = new URL('../src/lib/content-factory/knowledge/', import.meta.url).pathname;
const DB_PATH = join(CORPUS, '05_UNIFIED_DATA_LAKEHOUSE/03_gold/marts/unified_english_lake.sqlite');
const PHONETIC_JSON = join(CORPUS, '02_CURRICULUM_AND_FRAMEWORKS/vietnamese_english_phonetic_contrast.json');
const OXFORD_JSON = join(CORPUS, '02_CURRICULUM_AND_FRAMEWORKS/vocab_databases/oxford_5000_full.json');

mkdirSync(OUT, { recursive: true });

const db = new sqlite3.DatabaseSync(DB_PATH);
const q = (sql) => db.prepare(sql).all();

const header = (source) => `/*
 * GENERATED FILE — do not edit by hand.
 * Produced by scripts/extract-knowledge.mjs from ${source}.
 * Re-run \`pnpm content:extract\` to regenerate; output is deterministic.
 */
import type { KnowledgeEntry } from '../types';

`;

const emit = (name, entries, source, extraExports = '') => {
  const body =
    header(source) + `export const ${name}: KnowledgeEntry[] = ${JSON.stringify(entries, null, 2)};\n` + extraExports;
  writeFileSync(join(OUT, `${name.toLowerCase().replace(/_/g, '-')}.generated.ts`), body);
  console.log(`${name}: ${entries.length} entries`);
};

/* ---- functions ---- */
emit(
  'FN',
  q('SELECT * FROM dim_speaking_functions').map((r) => ({
    id: `fn.${String(r.function_id).padStart(2, '0')}`,
    kind: 'function',
    statement: `${r.speech_act_group}: ${r.function_name} — ${r.sample_phrases}`,
    glossVi: r.function_name,
    sourceRefs: ['nep-speaking-functions'],
    researchRefs: ['lake-functions'],
    evidenceLevel: 'corpus-measured',
    tags: [
      `cefr-${String(r.cefr_level).toLowerCase()}`,
      'speaking-function',
      r.speech_act_group.toLowerCase().replace(/\W+/g, '-'),
    ],
  })),
  'dim_speaking_functions',
);

/* ---- can-do ---- */
emit(
  'CANDO',
  q('SELECT * FROM fact_cefr_can_do').map((r) => ({
    id: `cando.${r.skill_code.toLowerCase()}.${String(r.cefr_level).toLowerCase()}`,
    kind: 'can-do',
    statement: r.can_do_descriptor,
    glossVi: r.illustrative_task,
    sourceRefs: ['nep-cando', 'cefr-can-do'],
    researchRefs: ['lake-cando'],
    evidenceLevel: 'framework',
    tags: [`cefr-${String(r.cefr_level).toLowerCase()}`, `skill-${r.skill_code.toLowerCase()}`, `gse-${r.gse_score}`],
  })),
  'fact_cefr_can_do',
);

/* ---- listening microskills ---- */
emit(
  'MICROSKILL',
  q('SELECT * FROM dim_listening_microskills').map((r) => ({
    id: `ms.t${r.tier_level}.${r.microskill_id}`,
    kind: 'listening-microskill',
    statement: `${r.microskill_name} — ${r.description}`,
    glossVi: r.cognitive_focus,
    sourceRefs: ['nep-microskills'],
    researchRefs: ['lake-microskills', 'listening-first-decoding'],
    evidenceLevel: 'framework',
    tags: [`tier-${r.tier_level}`, r.skill_category.toLowerCase().replace(/\W+/g, '-')],
  })),
  'dim_listening_microskills',
);

/* ---- collocations ---- */
emit(
  'COLLOCATION',
  q('SELECT * FROM fact_phrasal_collocations').map((r) => ({
    id: `col.${String(r.item_id).padStart(2, '0')}`,
    kind: 'collocation',
    statement: `${r.phrase} — ${r.example_en}`,
    glossVi: r.meaning_vi,
    sourceRefs: ['nep-collocations'],
    researchRefs: ['lsrules-chunks'],
    evidenceLevel: 'corpus-measured',
    tags: [`cefr-${String(r.cefr_level).toLowerCase()}`, r.category.toLowerCase().replace(/\W+/g, '-')],
  })),
  'fact_phrasal_collocations',
);

/* ---- grammar points ---- */
emit(
  'GRAMMAR',
  q('SELECT * FROM fact_grammar_mastery').map((r) => ({
    id: `gram.${String(r.grammar_id).padStart(2, '0')}`,
    kind: 'grammar-point',
    statement: `${r.topic_name}: ${r.usage_explanation} VN mistake: ${r.vietnamese_common_mistakes}`,
    glossVi: r.topic_name,
    sourceRefs: ['nep-grammar-errors'],
    researchRefs: ['vn-grammar-errors'],
    evidenceLevel: 'corpus-measured',
    tags: [`cefr-${String(r.cefr_level).toLowerCase()}`, 'grammar-support'],
  })),
  'fact_grammar_mastery',
);

/* ---- phonetic contrasts: 44 phonemes + VN pair risks ---- */
const phonemes = q('SELECT * FROM dim_pronunciation_phonemes').map((r) => ({
  id: `ph.${String(r.phoneme_id).padStart(2, '0')}`,
  kind: 'phonetic-contrast',
  statement: `${r.ipa_symbol} ${r.phoneme_type} — confusions: ${r.minimal_pair_confusions}`,
  sourceRefs: ['nep-phonemes'],
  researchRefs: ['vn-phonology'],
  evidenceLevel: 'framework',
  tags: ['phoneme', r.phoneme_type.toLowerCase().replace(/\W+/g, '-')],
}));
const pairs = JSON.parse(readFileSync(PHONETIC_JSON, 'utf8'));
const vnPairs = [...(pairs.vowel_pairs ?? []), ...(pairs.consonant_pairs ?? [])].map((p) => ({
  id: `phvn.${p.id.toLowerCase()}`,
  kind: 'phonetic-contrast',
  statement: `${p.pair} (${p.name}) — VN risk: ${p.vietnamese_risk} Pairs: ${(p.minimal_pairs ?? [])
    .slice(0, 4)
    .map((m) => `${m.w1}/${m.w2}`)
    .join(', ')}`,
  glossVi: p.vietnamese_risk,
  sourceRefs: ['nep-phonetic-db'],
  researchRefs: ['vn-phonology', 'vn-final-consonants'],
  evidenceLevel: 'corpus-measured',
  tags: ['vn-contrast', p.id.startsWith('VP') ? 'vowel-pair' : 'consonant-pair'],
}));
emit('PHONETIC', [...phonemes, ...vnPairs], 'dim_pronunciation_phonemes + vietnamese_english_phonetic_contrast.json');

/* ---- painpoint themes (aggregate, never raw posts) ---- */
const themes = q(
  `SELECT category_tag AS tag, primary_skill AS skill, COUNT(*) AS n
   FROM fact_learner_painpoints GROUP BY category_tag, primary_skill ORDER BY n DESC`,
).map((r) => ({
  id: `pp.${r.tag.toLowerCase().replace(/\W+/g, '-')}.${r.skill.toLowerCase().replace(/\W+/g, '-')}`,
  kind: 'painpoint-theme',
  statement: `${r.tag} in ${r.skill} — ${r.n} community posts`,
  sourceRefs: ['nep-painpoints'],
  researchRefs: ['lake-painpoints'],
  evidenceLevel: 'corpus-measured',
  tags: ['needs-analysis', r.skill.toLowerCase().replace(/\W+/g, '-')],
}));
emit('PAINPOINT', themes, 'fact_learner_painpoints (aggregated themes only)');

/* ---- situations ---- */
emit(
  'SITUATION',
  q('SELECT * FROM fact_functional_dialogues').map((r) => ({
    id: `sit.${String(r.dialogue_id).padStart(2, '0')}`,
    kind: 'situation',
    statement: `${r.scenario_title} — ${r.context_description}. Key expressions: ${r.key_expressions}`,
    glossVi: r.cultural_tip,
    sourceRefs: ['nep-dialogues'],
    researchRefs: ['lake-functions'],
    evidenceLevel: 'corpus-measured',
    tags: [`cefr-${String(r.cefr_level).toLowerCase()}`, 'situation'],
  })),
  'fact_functional_dialogues',
);

/* ---- Oxford 5000 level map (difficulty prior, compact) ---- */
const ox = JSON.parse(readFileSync(OXFORD_JSON, 'utf8'));
const words = Array.isArray(ox) ? ox : (ox.words ?? ox.entries ?? Object.values(ox));
const levels = {};
for (const w of words) {
  const word = w.word ?? w.headword ?? w.lemma;
  const lvl = (w.cefr ?? w.level ?? '').toUpperCase();
  if (word && /^[ABC][0-9]$/.test(lvl) && !(word in levels)) levels[word.toLowerCase()] = lvl;
}
const oxBody =
  `/*\n * GENERATED FILE — compact CEFR level map from oxford_5000_full.json.\n * Used as difficulty prior only (never learner-facing verbatim).\n */\n// biome-ignore-all lint/suspicious/noThenProperty: "then" is a real headword key, not a Promise\nexport const OXFORD_LEVELS: Record<string, string> = ` +
  JSON.stringify(levels) +
  ';\n';
writeFileSync(join(OUT, 'oxford-levels.generated.ts'), oxBody);
console.log(`OXFORD_LEVELS: ${Object.keys(levels).length} headwords`);

db.close();
console.log('done');
