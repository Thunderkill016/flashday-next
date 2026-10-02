import type Dexie from 'dexie';
import type { Table } from 'dexie';
import type { LearningAttempt } from '@/types/learning-activity';
import { currentLearnerId, type MediaBlobEntry } from './db';
import { commitMappedAttempt, mapLegacyAttempt } from './evidence-bridge/adapter';
import type { EvidenceEvent } from './evidence-bridge/types';
import { recordingIdentity } from './learning-activity';
import { validateTextCycleAttempt } from './text-learning-cycle';

export async function persistLearningAttempt(
  database: Dexie & {
    learningAttempts: Table<LearningAttempt>;
    mediaBlobs: Table<MediaBlobEntry>;
    evidenceEvents?: Table<EvidenceEvent, string>;
  },
  attempt: LearningAttempt,
  blob: Blob | undefined,
  isCurrent: () => boolean,
) {
  const guard = () => {
    if (!isCurrent()) throw new Error('Account changed');
  };
  guard();
  if (blob?.size) attempt.recordingId = await recordingIdentity(blob);
  guard();
  // W2-02 semantic-commit seam: a cycle stage is the semantic intent when
  // present, else the activity. Unmapped → legacy transaction untouched.
  const mapped = mapLegacyAttempt({
    id: attempt.id,
    kind: attempt.cycle ? 'text-cycle' : 'learning-attempt',
    mode: attempt.cycle?.stage ?? attempt.activity,
    occurredAt: attempt.createdAt,
    response: attempt.answer,
    // Declared support facts — an honest future mapper must carry all of
    // them into the submission; the adapter refuses closed if any drop.
    support: {
      ...(attempt.usedTranslation ? { translation: true } : {}),
      ...(attempt.cycle?.assisted ? { assisted: true } : {}),
      ...(attempt.cycle?.sourceRevealed ? { sourceRevealed: true } : {}),
    },
    feedback: attempt.feedback,
  });
  await database.transaction(
    'rw',
    [database.learningAttempts, database.mediaBlobs, ...(mapped ? [database.evidenceEvents!] : [])],
    async () => {
      guard();
      if (attempt.cycle) {
        const attempts = await database.learningAttempts.toArray();
        guard();
        const error = validateTextCycleAttempt(attempt, attempts);
        if (error) throw new Error(`Invalid cycle evidence: ${error}`);
      }
      const existing = attempt.recordingId ? await database.mediaBlobs.get(attempt.recordingId) : undefined;
      guard();
      if (attempt.recordingId && blob && !existing)
        await database.mediaBlobs.add({
          contentId: attempt.recordingId,
          blob,
          mimeType: blob.type,
          createdAt: attempt.createdAt,
        });
      guard();
      await database.learningAttempts.add(attempt);
      // Semantic event commits atomically with the attempt row; the account
      // guard can still roll both back.
      if (mapped) await commitMappedAttempt(database, mapped, currentLearnerId());
      guard();
    },
  );
}
