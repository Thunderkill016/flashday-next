/*
 * Content QA gate V2 (Part 8) — fails closed on every category.
 *
 * Structure / leakage / retrieval / production / transfer / provenance /
 * rights / runtime-truth / audio — every lesson AND every pack.
 */
import { v2CueText, v2LessonText } from './compile.ts';
import { findCycles, validateGraph } from './graph.ts';
import { RESEARCH_MANIFEST } from './research.ts';
import { SOURCE_MANIFEST } from './sources.ts';
import type { LessonSpec, TrackIdV2, ValidationIssue } from './types.ts';

const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();
const MIN_TARGETS = 3;
const MAX_TARGETS = 8;

const issue = (id: string, code: string, message: string): ValidationIssue => ({ id, code, message });

export function validateLesson(lesson: LessonSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const at = (code: string, message: string, id = lesson.id) => issues.push(issue(id, code, message));

  /* ---- Structure ---- */
  if (lesson.specVersion !== 'lesson-spec/v2') at('spec-version', `unknown specVersion "${lesson.specVersion}"`);
  if (!lesson.version.trim()) at('missing-version', 'lesson has no content version');
  if (!lesson.task.trim()) at('missing-task', 'lesson has no target task');
  if (!lesson.context.trim()) at('missing-context', 'lesson has no context');
  if (!lesson.outcome.trim()) at('missing-outcome', 'lesson has no communicative outcome');
  if (!lesson.input.text.trim() || !lesson.title.trim()) at('missing-input', 'lesson has no input text/title');
  if (!lesson.capabilities.length) at('no-capabilities', 'lesson trains no declared capability');
  if (lesson.targets.length < MIN_TARGETS || lesson.targets.length > MAX_TARGETS)
    at('target-count', `lesson has ${lesson.targets.length} targets (allowed ${MIN_TARGETS}-${MAX_TARGETS})`);
  if (!lesson.supportLadder.length) at('empty-support-ladder', 'lesson has no support ladder');

  /* ---- Provenance / rights — fail closed on the exact source ---- */
  if (!lesson.sourceRefs.length) at('missing-source-refs', 'lesson cites no sourceRefs');
  if (!lesson.researchRefs.length) at('missing-research-refs', 'lesson cites no researchRefs');
  for (const ref of lesson.sourceRefs) {
    const source = SOURCE_MANIFEST[ref];
    if (!source) at('unknown-source-ref', `unknown sourceRef "${ref}"`);
    else if (source.klass === 'REJECTED') at('rejected-source', `REJECTED source "${ref}" cited on a lesson`);
  }
  for (const ref of lesson.researchRefs)
    if (!RESEARCH_MANIFEST[ref]) at('unknown-research-ref', `unknown researchRef "${ref}"`);
  if (lesson.input.origin === 'derived') {
    if (!lesson.input.sourceRefId) {
      at('derived-source-missing', 'derived input lacks input.sourceRefId');
    } else {
      if (!lesson.sourceRefs.includes(lesson.input.sourceRefId))
        at('derived-source-not-cited', `input.sourceRefId "${lesson.input.sourceRefId}" is not cited in sourceRefs`);
      const source = SOURCE_MANIFEST[lesson.input.sourceRefId];
      if (!source) at('unknown-source-ref', `unknown input.sourceRefId "${lesson.input.sourceRefId}"`);
      else if (source.klass === 'REFERENCE_ONLY' || source.klass === 'REJECTED')
        at('derived-from-restricted', `input derives from ${source.klass} source "${lesson.input.sourceRefId}"`);
    }
  } else if (lesson.input.sourceRefId) {
    const source = SOURCE_MANIFEST[lesson.input.sourceRefId];
    if (!source) at('unknown-source-ref', `unknown input.sourceRefId "${lesson.input.sourceRefId}"`);
    else if (source.klass === 'REFERENCE_ONLY' || source.klass === 'REJECTED')
      at('derived-from-restricted', `input claims ${source.klass} source "${lesson.input.sourceRefId}"`);
  }

  /* ---- Leakage — never reveal the answer before attempt ---- */
  if (lesson.supportLadder[0] === 'full-answer') at('support-starts-at-answer', 'support ladder starts at full-answer');
  const inputText = normalize(lesson.input.text);
  const composed = normalize(v2LessonText(lesson));
  if (!composed.includes(inputText)) at('missing-input', 'composed lesson text lost the input verbatim');
  for (const target of lesson.targets) {
    const tag = `${lesson.id}/${target.id}`;
    const chunk = normalize(target.chunk);
    if (!target.chunk.trim() || !target.sourceSentence.trim()) {
      at('chunk-not-in-source', 'target missing chunk or source sentence', tag);
      continue;
    }
    if (!normalize(target.sourceSentence).includes(chunk))
      at('chunk-not-in-source', `chunk "${target.chunk}" not inside sourceSentence`, tag);
    if (!inputText.includes(normalize(target.sourceSentence)))
      at('source-not-in-input', `sourceSentence not inside input.text: "${target.sourceSentence}"`, tag);
    if (normalize(target.cueVi).includes(chunk))
      at('cue-leaks-answer', `cueVi contains the target chunk: "${target.cueVi}"`, tag);
    if (!v2CueText(target).includes('___'))
      at('answer-visible', `cloze prompt does not mask the chunk: "${v2CueText(target)}"`, tag);
  }

  /* ---- Retrieval / production affordances ---- */
  if (!lesson.targets.length || !lesson.reviewVariants.length)
    at('no-retrieval', 'lesson has no retrieval targets or review variants');
  const produces = lesson.targets.some(
    (t) => t.productionPattern.trim() && normalize(t.productionPattern) !== normalize(t.chunk),
  );
  if (!produces) at('no-production', 'no target provides an open-slot productionPattern');

  /* ---- Transfer must change a real dimension ---- */
  if (!lesson.transferTask.prompt.trim() || !lesson.transferTask.promptVi.trim())
    at('no-transfer', 'lesson has no changed-context transfer prompt');
  else if (!lesson.transferTask.changesDimension.trim())
    at('no-transfer', 'transfer task does not name the changed dimension');
  else if (normalize(lesson.transferTask.prompt) === normalize(lesson.input.title))
    at('fake-transfer', 'transfer prompt duplicates the input title — same situation is not transfer');

  /* ---- Audio/listening claims (Part 8 audio rule) ---- */
  const audioSteps = lesson.supportLadder.filter((s) => s === 'audio' || s === 'transcript');
  const claimsListening = lesson.track === 'listening' || lesson.track === 'pronunciation';
  if (!claimsListening && audioSteps.length)
    at('audio-outside-listening', 'audio/transcript support steps only valid on listening/pronunciation tracks');
  if (claimsListening) {
    if (!audioSteps.includes('audio') || !lesson.reviewVariants.includes('audio-to-meaning'))
      at('missing-audio-path', 'listening lesson lacks audio ladder step or audio-to-meaning variant');
    for (const target of lesson.targets)
      if ((target.kind === 'listening' || target.kind === 'pronunciation') && !target.pronunciationNote?.trim())
        at(
          'missing-audio-path',
          `target "${target.id}" claims ${target.kind} but has no pronunciationNote`,
          `${lesson.id}/${target.id}`,
        );
    if (
      lesson.audioSource !== 'tts-synthetic' &&
      lesson.audioSource !== 'recorded' &&
      lesson.audioSource !== 'source-audio'
    )
      at('audio-source-undeclared', 'listening lesson must declare audioSource (tts-synthetic|recorded|source-audio)');
  } else if (lesson.audioSource) {
    at('audio-source-outside-listening', 'audioSource declared on a non-listening lesson');
  }

  /* ---- VN support must not hand over the answer (Part 16) ---- */
  for (const target of lesson.targets)
    if (target.contrastVi && normalize(target.contrastVi).includes(normalize(target.chunk)))
      at('support-leaks-answer', `contrastVi contains the chunk: "${target.chunk}"`, `${lesson.id}/${target.id}`);

  return issues;
}

export function validatePack(
  lessons: LessonSpec[],
  packId: string,
  externalIds?: ReadonlySet<string>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const lessonIds = new Set<string>();
  const targetIds = new Set<string>();
  for (const lesson of lessons) {
    if (lessonIds.has(lesson.id))
      issues.push(issue('pack', 'duplicate-lesson-id', `duplicate lesson id "${lesson.id}"`));
    lessonIds.add(lesson.id);
    for (const target of lesson.targets) {
      if (targetIds.has(target.id))
        issues.push(issue('pack', 'duplicate-target-id', `duplicate target id "${target.id}"`));
      targetIds.add(target.id);
    }
    issues.push(...validateLesson(lesson));
  }
  for (const gi of validateGraph(lessons, externalIds)) issues.push(issue('pack', `graph-${gi.code}`, gi.message));
  /* Recycling cycles are legal (a<->b reuses both ways) but flag big loops. */
  for (const cyc of findCycles(
    lessons.flatMap((l) => l.recyclingFrom.map((to) => ({ from: l.id, to, kind: 'recycles' as const }))),
  ))
    if (cyc.length > 4) issues.push(issue('pack', 'recycle-loop', `suspicious recycling loop: ${cyc.join(' -> ')}`));
  return issues;
}

/* Library-level check: the full V2 spine needs every declared track.
 * Per-pack seeding legitimately holds a subset — do not run this there. */
export function validateLibrary(lessons: LessonSpec[], libraryId: string): ValidationIssue[] {
  const issues = validatePack(lessons, libraryId);
  const present = new Set(lessons.map((l) => l.track));
  const expected: TrackIdV2[] = ['survival', 'everyday', 'chunks', 'listening', 'pronunciation', 'developer'];
  for (const t of expected)
    if (!present.has(t)) issues.push(issue(libraryId, 'missing-track', `library has no ${t} lessons`));
  return issues;
}
