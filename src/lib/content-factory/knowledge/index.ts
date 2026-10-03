/* Knowledge layer index — generated tables + lookup helpers. */

import type { KnowledgeEntry } from '../types.ts';
import { CANDO } from './cando.generated.ts';
import { COLLOCATION } from './collocation.generated.ts';
import { FN } from './fn.generated.ts';
import { GRAMMAR } from './grammar.generated.ts';
import { MICROSKILL } from './microskill.generated.ts';
import { OXFORD_LEVELS } from './oxford-levels.generated.ts';
import { PAINPOINT } from './painpoint.generated.ts';
import { PHONETIC } from './phonetic.generated.ts';
import { SITUATION } from './situation.generated.ts';

export { OXFORD_LEVELS };

export const ALL_KNOWLEDGE: KnowledgeEntry[] = [
  ...FN,
  ...CANDO,
  ...MICROSKILL,
  ...COLLOCATION,
  ...GRAMMAR,
  ...PHONETIC,
  ...PAINPOINT,
  ...SITUATION,
];

export const knowledgeById = new Map(ALL_KNOWLEDGE.map((k) => [k.id, k]));

export const knowledgeByKind = (kind: KnowledgeEntry['kind']) => ALL_KNOWLEDGE.filter((k) => k.kind === kind);
