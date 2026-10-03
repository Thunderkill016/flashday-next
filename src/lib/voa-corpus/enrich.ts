/*
 * FD-VOA-CORPUS-01 §17–24 — deterministic linguistic enrichment.
 *
 * Every mapping uses existing FlashDay sources (Oxford, NEP functions,
 * collocations, microskills, VN phonetic DB, capability ontology).
 * No LLM in the enrichment path — matches are inspectable strings.
 */
import { ALL_KNOWLEDGE, OXFORD_LEVELS } from '../content-factory/knowledge/index.ts';
import { CAPABILITIES } from '../fd-content-v2/capabilities.ts';
import { V2_LESSONS } from '../fd-content-v2/index.ts';
import { contentWords, headword, oxfordCoverage, tokenize } from './level.ts';
import type { VoaLinguisticEnrichment } from './types.ts';

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/* ── curriculum chunk inventory (V2 targets + NEP collocations) ──── */
export function curriculumChunks(): Map<string, { source: string; lessonId?: string; targetId?: string }> {
  const map = new Map<string, { source: string; lessonId?: string; targetId?: string }>();
  for (const l of V2_LESSONS)
    for (const t of l.targets) map.set(norm(t.chunk), { source: 'v2-target', lessonId: l.id, targetId: t.id });
  for (const k of ALL_KNOWLEDGE.filter((e) => e.kind === 'collocation' || e.kind === 'function')) {
    /* extract the English head of "statement" — before the em-dash/paren */
    const head = k.statement.split(/—|\(|:/)[0].trim();
    if (head && !map.has(norm(head))) map.set(norm(head), { source: k.kind });
  }
  return map;
}

/* n-gram chunk candidates (2–4 words) that are plausible formulaic
 * sequences: appear ≥2× in the resource OR match a knowledge head. */
export function extractChunkCandidates(text: string): string[] {
  const words = tokenize(text);
  const grams = new Map<string, number>();
  for (let n = 2; n <= 4; n++)
    for (let i = 0; i + n <= words.length; i++) {
      const g = words.slice(i, i + n).join(' ');
      if (/\d|^(a|an|the|to|of|in|on|at|is|are|was|were|be|it|its|that|this)\b/.test(g)) continue;
      grams.set(g, (grams.get(g) ?? 0) + 1);
    }
  const known = curriculumChunks();
  const out = new Set<string>();
  for (const [g, c] of grams) {
    if (known.has(g)) {
      out.add(g);
      continue;
    }
    if (c >= 2 && g.split(' ').length >= 2) out.add(g);
  }
  /* also match known chunks as substrings of the raw text (norm-joined) */
  const ntext = ` ${norm(text)} `;
  for (const g of known.keys()) if (ntext.includes(` ${g} `)) out.add(g);
  return [...out];
}

/* capability/function matching — capability names + fn gloss terms as
 * keyword probes over the normalized text. Conservative: only emit a
 * mapping when a distinctive keyword hits. */
const CAP_PROBES: Record<string, string[]> = {
  'greet-leave': ['good morning', 'goodbye', 'see you', 'how are you', 'nice to meet'],
  'introduce-self': ['my name is', 'i am from', 'this is my'],
  'ask-personal-info': ['where are you from', 'what is your name', 'how old are'],
  'clarify-meaning': ['what does', 'what do you mean', 'i do not understand', "i don't understand"],
  'ask-repetition': ['say that again', 'repeat', 'slow down', 'more slowly'],
  'request-help': ['could you', 'can you help', 'please help', 'would you'],
  'express-thanks': ['thank you', 'thanks', 'you are welcome'],
  'small-talk': ['how was your', 'nice day', 'weekend', 'weather'],
  'describe-routine': ['every day', 'usually', 'always', 'wake up', 'go to work'],
  'make-plans': ['going to', 'plan to', 'tomorrow', 'next week', 'meet me'],
  'narrate-past': ['yesterday', 'last week', 'ago', 'happened'],
  'express-opinion': ['i think', 'i believe', 'in my opinion', 'i agree', 'i disagree'],
  'ask-price': ['how much', 'it costs', 'the price', 'dollars'],
  'order-food': ['i would like', 'can i have', 'the menu', 'to order', 'check please'],
  'ask-directions': ['how do i get', 'where is the', 'turn left', 'turn right', 'straight ahead'],
  'describe-problem': ['the problem is', 'something is wrong', 'it is broken', 'not working'],
  'schedule-appointment': ['appointment', 'schedule', 'how about', 'that works'],
  'phone-basics': ['on the phone', 'call back', 'hold on'],
  'book-travel': ['flight', 'ticket', 'passport', 'board', 'gate'],
  'decode-weak-forms': ['going to', 'want to', 'have to', 'kind of'],
  'decode-linking': ['an apple', 'turn it', 'check it out'],
  'estimate-uncertainty': ['i guess', 'probably', 'maybe', 'i am not sure', "i'm not sure"],
  'handoff-work': ['hand off', 'take over', 'while i am out', 'watch out for'],
  'report-bug': ['bug', 'crash', 'error', 'broken', 'does not work'],
  'buy-time': ['deadline', 'by friday', 'more time', 'extension', 'a few more days'],
  apologize: ['i am sorry', "i'm sorry", 'my apologies', 'forgive me'],
  'handle-emergency': ['emergency', 'call 911', 'ambulance', 'fire department'],
  'see-doctor': ['doctor', 'appointment', 'symptoms', 'it hurts', 'medicine'],
  'hotel-checkin': ['check in', 'reservation', 'room key', 'front desk'],
  'shop-return': ['return this', 'refund', 'receipt', 'exchange'],
  'pay-bills': ['pay the bill', 'utility bill', 'overdue', 'bank account'],
  'invite-respond': ['would you like to come', 'are you free', 'that sounds fun', "i'd love to"],
  'compare-things': ['better than', 'cheaper than', 'more expensive', 'which one'],
  'hedge-statement': ['kind of', 'sort of', 'i guess', 'not really sure'],
  'give-reason': ['because', 'the reason is', 'that is why', "that's why"],
  'tell-story': ['once upon a time', 'a long time ago', 'guess what happened'],
  'make-offer': ['how about', 'i can offer', 'would you take', 'deal'],
  'ask-favor': ['could you do me a favor', 'would you mind', 'can i ask you'],
  'decode-boundaries': ['word boundary', 'did you say', 'sounds like'],
  'decode-reductions': ['gonna', 'wanna', 'gotta', 'lemme'],
  'decode-final-consonants': ['final sound', 'end of the word'],
  'decode-clusters': ['consonant cluster', 'two consonants'],
  'decode-numbers': ['fifteen', 'fifty', 'thirteen', 'thirty', 'hundred'],
  'decode-names': ['spell your name', 'how do you spell', 'capital letter'],
  'extract-detail': ['according to', 'the report says', 'details'],
  'track-signposts': ['first', 'second', 'finally', 'in conclusion', 'next'],
  'catch-gist': ['main idea', 'in general', 'overall'],
  'infer-tone': ['sounds angry', 'seems happy', 'tone of voice'],
  'hear-fast-questions': ['whaddaya', 'dijou', 'didja'],
  'status-update': ['status update', 'progress report', 'on track'],
  'clarify-requirements': ['the requirements', 'what exactly', 'do you mean'],
  'reproduce-steps': ['steps to reproduce', 'i tried', 'it fails'],
  'ask-help': ['can someone help', 'i need help', 'stuck'],
  'explain-implementation': ['the code does', 'it works by', 'implementation'],
  'review-code': ['code review', 'pull request', 'lgtm', 'nitpick'],
  'discuss-pr': ['merge request', 'pull request', 'code review'],
  'notify-deploy': ['deploy', 'release', 'went live', 'rollout'],
  'report-incident': ['incident', 'outage', 'is down', 'service disruption'],
  'disagree-technical': ['i disagree because', 'that approach', 'trade-off'],
  'ask-documentation': ['documentation', 'docs say', 'readme'],
  'participate-meeting': ['meeting', 'agenda', 'action items'],
  'schedule-meeting': ['schedule a meeting', 'calendar invite', 'what time works'],
  'message-async': ['slack message', 'email me', 'ping me'],
  'demo-feature': ['demo', 'let me show you', 'walkthrough'],
  'escalate-issue': ['escalate', 'manager', 'higher priority'],
  'postmortem-writeup': ['postmortem', 'root cause', 'what went wrong'],
};

export function mapCapabilities(text: string): { capabilities: string[]; functions: string[] } {
  const n = ` ${norm(text)} `;
  const caps: string[] = [];
  /* space-padded text → ' probe ' matches whole words/phrases only;
   * 'gate' can't fire inside 'navigate', 'bug' can't fire inside 'debug' */
  for (const [capId, probes] of Object.entries(CAP_PROBES))
    if (probes.some((p) => n.includes(` ${p} `))) caps.push(capId);
  const fns = new Set<string>();
  for (const c of caps) for (const f of CAPABILITIES[c]?.fns ?? []) fns.add(f);
  return { capabilities: caps, functions: [...fns].sort() };
}

const GRAMMAR_PROBES: Record<string, { re: RegExp; label: string }> = {
  'present-simple': { re: /\b(every day|always|usually|often|never)\b/i, label: 'present-simple' },
  'past-simple': { re: /\b(yesterday|last \w+|ago)\b/i, label: 'past-simple' },
  'present-continuous': { re: /\b(am|is|are) \w+ing\b/i, label: 'present-continuous' },
  'going-to-future': { re: /\bgoing to\b/i, label: 'going-to-future' },
  'wh-questions': { re: /\b(what|where|when|why|how|who) (?:is|are|do|does|did|can)\b/i, label: 'wh-questions' },
  'yes-no-questions': { re: /\b(do|does|did|can|could|are|is) you\b/i, label: 'yes-no-questions' },
  'modals-request': { re: /\b(could|can|would) you\b/i, label: 'modals-request' },
  comparatives: { re: /\b\w+er than\b|more \w+ than/i, label: 'comparatives' },
  articles: { re: /\b(a|an|the) [a-z]/i, label: 'articles' },
  'prepositions-place': { re: /\b(at|on|in|next to|across from|between) the\b/i, label: 'prepositions-place' },
  imperatives: { re: /\b(please|let's|let us|do not|don't)\b/i, label: 'imperatives' },
  'there-is-are': { re: /\bthere (is|are|was|were)\b/i, label: 'there-is-are' },
};

/* §22 — listening microskills: emit REAL ontology ids (ms.*), not
 * invented labels. Text-side evidence only — these tag what the
 * material exercises, never learner mastery. */
const LISTENING_PROBES: Record<string, RegExp> = {
  'ms.t1.3': /\b(gonna|wanna|gotta|kinda|sorta)\b|\b[a-z]+ (an|in|it|on|at|of|up|out)\b/i, // reduced forms + linking
  'ms.t3.6':
    /\b(\d+|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\b|\b[A-Z][a-z]{2,}\b/, // numbers/dates/names → detail extraction
  'ms.t3.7': /\b(first|second|third|then|next|finally|however|in conclusion|for example|meanwhile)\b/i, // signposts
};

/* §23 — VN-learner phonetic risk: emit phvn.* contrast ids with
 * orthographic evidence in the text. Deterministic surface detection —
 * a tag for material relevance, not a pronunciation assessment. */
const PRONUNCIATION_PROBES: Record<string, RegExp> = {
  'phvn.cp_01': /\b\w*th\w*/i, // θ/ð words — VN dental-fricative risk
  'phvn.cp_02': /\b\w*(sh|tion|sion|sure)\w*/i, // ʃ-words
  'phvn.cp_03': /\b\w*(dg|gi|gy)\w*|\bj\w*/i, // dʒ/tʃ/j words
  'phvn.cp_04': /\b\w{2,}(st|ts|ks|x|ps|pt|kt|ft|ld|nd|nt|mp|nk|sk|sp|cts|sks|sts)\b/i, // final clusters
  'phvn.vp_01': /\b\w*(ee|ea)\w*/i, // tense/lax high-front-vowel words
  'phvn.vp_02': /\b\w*oo\w*/i, // uː/ʊ words
};

/* topic buckets for the search index (§39) — coarse domain vocab probes */
const TOPIC_PROBES: Record<string, RegExp> = {
  food: /\b(eat|food|restaurant|cook|meal|recipe|hungry)\b/i,
  travel: /\b(travel|flight|hotel|airport|trip|ticket|passport)\b/i,
  health: /\b(health|doctor|hospital|medicine|sick|disease)\b/i,
  work: /\b(job|office|boss|employee|career|salary)\b/i,
  education: /\b(school|student|teacher|learn|class|university)\b/i,
  science: /\b(science|research|space|climate|experiment|study found)\b/i,
  technology: /\b(computer|internet|software|app\b|data|robot|AI)\b/i,
  family: /\b(family|mother|father|child|children|parents)\b/i,
  money: /\b(money|price|dollar|buy|sell|shop|cost)\b/i,
  culture: /\b(music|film|movie|art|festival|culture|song)\b/i,
  history: /\b(history|president|war|century|historical)\b/i,
  nature: /\b(animal|tree|river|weather|environment|forest|ocean)\b/i,
};

export function enrichText(text: string): VoaLinguisticEnrichment {
  const all = tokenize(text);
  const content = contentWords(text);
  const cov = oxfordCoverage(content);
  const chunks = extractChunkCandidates(text);
  const known = curriculumChunks();
  const { capabilities, functions } = mapCapabilities(text);

  const grammar = Object.values(GRAMMAR_PROBES)
    .filter((p) => p.re.test(text))
    .map((p) => p.label);
  const listening = Object.entries(LISTENING_PROBES)
    .filter(([, re]) => re.test(text))
    .map(([id]) => id);
  const pronunciation = Object.entries(PRONUNCIATION_PROBES)
    .filter(([, re]) => re.test(text))
    .map(([id]) => id);
  const topics = Object.entries(TOPIC_PROBES)
    .filter(([, re]) => re.test(text))
    .map(([tag]) => tag);

  const outOfBand = [...new Set(content.filter((w) => !OXFORD_LEVELS[headword(w)]))]
    .filter((w) => w.length > 2 && !/^\d/.test(w))
    .slice(0, 40);
  const knownChunks = chunks.filter((c) => known.has(c));
  const newChunks = chunks.filter((c) => !known.has(c)).slice(0, 40);

  return {
    knownHeadwords: new Set(content.filter((w) => OXFORD_LEVELS[headword(w)])).size,
    outOfBandWords: outOfBand,
    oxfordCoverage: Object.fromEntries(
      Object.entries(cov)
        .filter(([k]) => k !== '__known')
        .map(([k, v]) => [k, Math.round(v * 1000) / 1000]),
    ),
    lexicalDensity: all.length ? Math.round((content.length / all.length) * 1000) / 1000 : 0,
    targetCandidates: outOfBand.slice(0, 12),
    knownChunks,
    newChunks,
    domainChunks: [],
    communicativeFunctions: functions,
    capabilities,
    grammarFeatures: grammar,
    listeningFeatures: listening,
    pronunciationFeatures: pronunciation,
    topicTags: topics,
  };
}
