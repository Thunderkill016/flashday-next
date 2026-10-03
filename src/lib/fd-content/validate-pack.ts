/*
 * Content QA gate for flashday-foundation-v1 (mission §30).
 *
 * Returns one PackIssue per violation; an empty array means the pack may
 * ship. Codes are stable strings so tests can assert specific failures.
 * The gate fails closed: anything it cannot structurally verify is an
 * error, never a warning that gets waved through.
 */
import { fd01CueText, fd01LessonText } from './pack';
import { RESEARCH_REFERENCES, SOURCE_REFERENCES } from './references';
import type { PackLesson, TrackId } from './types';

export interface PackIssue {
  /** Which lesson/activity the issue belongs to (`pack` for pack-level). */
  id: string;
  code:
    | 'missing-task'
    | 'missing-context'
    | 'missing-outcome'
    | 'missing-input'
    | 'missing-source-refs'
    | 'missing-research-refs'
    | 'no-retrieval'
    | 'answer-visible'
    | 'no-production'
    | 'no-transfer'
    | 'target-count'
    | 'unknown-source-ref'
    | 'unknown-research-ref'
    | 'rejected-source'
    | 'derived-from-restricted'
    | 'derived-source-missing'
    | 'derived-source-not-cited'
    | 'audio-outside-track-d'
    | 'missing-audio-path'
    | 'duplicate-lesson-id'
    | 'duplicate-activity-id'
    | 'cue-leaks-answer'
    | 'chunk-not-in-source'
    | 'source-not-in-input'
    | 'support-starts-at-answer'
    | 'empty-support-ladder'
    | 'track-count';
  message: string;
}

const EXPECTED_TRACK_COUNTS: Record<TrackId, number> = { a: 8, b: 6, c: 6, d: 4, e: 6 };
const MIN_TARGETS = 4;
const MAX_TARGETS = 8;
const normalize = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();

export function validatePackLesson(lesson: PackLesson): PackIssue[] {
  const issues: PackIssue[] = [];
  const at = (code: PackIssue['code'], message: string, id = lesson.id) => issues.push({ id, code, message });

  /* Required task framing — planning unit is a communicative task. */
  if (!lesson.task.trim()) at('missing-task', 'lesson has no target task');
  if (!lesson.context.trim()) at('missing-context', 'lesson has no context');
  if (!lesson.outcome.trim()) at('missing-outcome', 'lesson has no communicative outcome');
  if (!lesson.input.text.trim() || !lesson.title.trim()) at('missing-input', 'lesson has no input text/title');

  /* Provenance — every lesson cites sources and research. */
  if (!lesson.sourceRefs.length) at('missing-source-refs', 'lesson cites no sourceRefs');
  if (!lesson.researchRefs.length) at('missing-research-refs', 'lesson cites no researchRefs');
  for (const ref of lesson.sourceRefs) {
    const source = SOURCE_REFERENCES[ref];
    if (!source) at('unknown-source-ref', `unknown sourceRef "${ref}"`);
    else if (source.klass === 'REJECTED') at('rejected-source', `REJECTED source "${ref}" cited on a lesson`);
  }
  for (const ref of lesson.researchRefs)
    if (!RESEARCH_REFERENCES[ref]) at('unknown-research-ref', `unknown researchRef "${ref}"`);

  /* Rights gate — provenance binds to the EXACT source. A derived input
   * must name input.sourceRefId, that ref must be cited in sourceRefs,
   * and it must be derivable. An unrelated derivable ref elsewhere in
   * sourceRefs does not back this input (review P1). */
  if (lesson.input.origin === 'derived') {
    if (!lesson.input.sourceRefId) {
      at('derived-source-missing', 'input marked derived but input.sourceRefId is absent');
    } else {
      if (!lesson.sourceRefs.includes(lesson.input.sourceRefId))
        at(
          'derived-source-not-cited',
          `input.sourceRefId "${lesson.input.sourceRefId}" is not cited in sourceRefs — derivation must be explicit`,
        );
      const source = SOURCE_REFERENCES[lesson.input.sourceRefId];
      if (!source) at('unknown-source-ref', `unknown input.sourceRefId "${lesson.input.sourceRefId}"`);
      else if (source.klass === 'REFERENCE_ONLY' || source.klass === 'REJECTED')
        at(
          'derived-from-restricted',
          `input derives from ${source.klass} source "${lesson.input.sourceRefId}" — never embed restricted material`,
        );
    }
  } else if (lesson.input.sourceRefId) {
    const source = SOURCE_REFERENCES[lesson.input.sourceRefId];
    if (!source) at('unknown-source-ref', `unknown input.sourceRefId "${lesson.input.sourceRefId}"`);
    else if (source.klass === 'REFERENCE_ONLY' || source.klass === 'REJECTED')
      at(
        'derived-from-restricted',
        `input claims ${source.klass} source "${lesson.input.sourceRefId}" — never embed restricted material`,
      );
  }

  /* Track D audio claim — audio/transcript are authored pedagogy steps
   * that only the listening track may carry. A track-D lesson must
   * actually offer the audio path (ladder + audio-to-meaning variant),
   * and every track-D target must bind a heard-form hint to the item's
   * pronunciation field so the claim reaches a rendered surface. */
  const audioSteps = lesson.supportLadder.filter((s) => s === 'audio' || s === 'transcript');
  if (lesson.track !== 'd' && audioSteps.length)
    at('audio-outside-track-d', 'audio/transcript support steps are only valid on track D lessons');
  if (lesson.track === 'd') {
    if (!audioSteps.includes('audio') || !lesson.reviewVariants.includes('audio-to-meaning'))
      at(
        'missing-audio-path',
        'track D claims listening support but ladders no audio step or audio-to-meaning variant',
      );
    for (const target of lesson.targets)
      if (!target.pronunciationNote?.trim())
        at(
          'missing-audio-path',
          `target "${target.id}" has no pronunciationNote — heard-form hint is the audio binding`,
          `${lesson.id}/${target.id}`,
        );
  }

  /* Retrieval exists and never reveals the answer first. */
  if (!lesson.targets.length || !lesson.reviewVariants.length)
    at('no-retrieval', 'lesson has no retrieval targets or review variants');
  if (lesson.targets.length > 0 && (lesson.targets.length < MIN_TARGETS || lesson.targets.length > MAX_TARGETS))
    at('target-count', `lesson has ${lesson.targets.length} active targets (allowed ${MIN_TARGETS}-${MAX_TARGETS})`);
  if (!lesson.supportLadder.length) at('empty-support-ladder', 'lesson has no support ladder');
  if (lesson.supportLadder[0] === 'full-answer')
    at('support-starts-at-answer', 'support ladder starts at full-answer — attempt must precede reveal');

  const inputText = normalize(lesson.input.text);
  for (const target of lesson.targets) {
    const tag = `${lesson.id}/${target.id}`;
    const chunk = normalize(target.chunk);
    const sentence = normalize(target.sourceSentence);
    if (!target.chunk.trim() || !target.sourceSentence.trim()) {
      at('chunk-not-in-source', 'target missing chunk or source sentence', tag);
      continue;
    }
    /* The chunk must be a literal substring of a sentence that is itself a
     * literal substring of the input — typed recall stays verbatim. */
    if (!sentence.includes(chunk)) at('chunk-not-in-source', `chunk "${target.chunk}" not inside sourceSentence`, tag);
    if (!inputText.includes(sentence))
      at('source-not-in-input', `sourceSentence not inside input.text: "${target.sourceSentence}"`, tag);
    /* Answer must not be visible before the retrieval attempt: the cue
     * may not contain the chunk, and the cloze must actually mask it. */
    if (normalize(target.cueVi).includes(chunk))
      at('cue-leaks-answer', `cueVi contains the target chunk: "${target.cueVi}"`, tag);
    if (!fd01CueText(target).includes('___'))
      at('answer-visible', `cloze prompt does not mask the chunk: "${fd01CueText(target)}"`, tag);
    /* Production affordance: an open-slot pattern, never the raw answer. */
    if (!target.productionPattern.trim() || normalize(target.productionPattern) === chunk)
      at('no-production', 'target has no open-slot productionPattern', tag);
  }

  /* Production and changed-context transfer are mandatory per lesson. */
  if (!lesson.transferTask.prompt.trim() || !lesson.transferTask.promptVi.trim())
    at('no-transfer', 'lesson has no changed-context transfer prompt');
  else if (!lesson.transferTask.changesDimension.trim())
    at('no-transfer', 'transfer task does not name the changed dimension');

  /* The composed learner text must still carry the input verbatim —
   * evidence quotes come from it. */
  if (!normalize(fd01LessonText(lesson)).includes(inputText))
    at('missing-input', 'composed lesson text lost the input verbatim');

  return issues;
}

export function validatePack(lessons: PackLesson[]): PackIssue[] {
  const issues: PackIssue[] = [];
  const lessonIds = new Set<string>();
  const activityIds = new Set<string>();
  for (const lesson of lessons) {
    if (lessonIds.has(lesson.id))
      issues.push({ id: lesson.id, code: 'duplicate-lesson-id', message: `duplicate lesson id "${lesson.id}"` });
    lessonIds.add(lesson.id);
    for (const target of lesson.targets) {
      if (activityIds.has(target.id))
        issues.push({
          id: target.id,
          code: 'duplicate-activity-id',
          message: `duplicate target id "${target.id}"`,
        });
      activityIds.add(target.id);
    }
    issues.push(...validatePackLesson(lesson));
  }
  for (const [track, expected] of Object.entries(EXPECTED_TRACK_COUNTS) as [TrackId, number][]) {
    const count = lessons.filter((l) => l.track === track).length;
    if (count !== expected)
      issues.push({
        id: 'pack',
        code: 'track-count',
        message: `track ${track} has ${count} lessons (expected ${expected})`,
      });
  }
  return issues;
}
