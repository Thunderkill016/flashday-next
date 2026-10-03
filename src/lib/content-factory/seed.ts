/*
 * V2 pack seeder (Part 18) — migration/progress safety.
 *
 * Safety contract, pinned by tests:
 *  - deterministic ids -> self-idempotent; second run writes nothing
 *  - learner-deleted items (deletedAt set) are NEVER resurrected
 *  - records/FSRS tables are never touched — scheduler state survives
 *  - stable ids come from the pack manifest; wording edits keep them
 *  - validation runs first and fails closed: a broken pack writes nothing
 */
import { db } from '@/lib/db';
import { compilePack } from './compile.ts';
import type { LessonSpec, PackManifest } from './types.ts';
import { validatePack } from './validate.ts';

export interface V2SeedResult {
  contentsAdded: number;
  collectionsAdded: number;
  skippedDeleted: number;
}

export interface V2SeedContext {
  /** Lessons living in declared dependency packs — legitimate edge targets. */
  dependencyLessons?: LessonSpec[];
  /** Capability ontology — required so ghost capabilities fail closed. */
  knownCapabilities: ReadonlySet<string>;
}

export async function seedV2Pack(
  pack: PackManifest,
  lessons: LessonSpec[],
  now: number,
  ctx: V2SeedContext,
): Promise<V2SeedResult> {
  /* Edges into declared dependency packs are legal — resolve them against
   * the dependency lessons the caller supplies instead of rejecting. */
  const externalIds = new Set((ctx.dependencyLessons ?? []).map((l) => l.id));
  const issues = validatePack(lessons, pack.packId, { externalIds, knownCapabilities: ctx.knownCapabilities });
  if (issues.length) {
    const summary = issues.map((i) => `${i.id}:${i.code}`).join(', ');
    throw new Error(`pack ${pack.packId} failed validation (${issues.length}): ${summary.slice(0, 2000)}`);
  }

  const { items, collections } = compilePack(pack, lessons, now);

  /* bulkGet returns rows including soft-deleted ones — a row with
   * deletedAt must NOT be overwritten back to life. */
  const existingContents = await db.contents.bulkGet(items.map((c) => c.id));
  let skippedDeleted = 0;
  const missingContents = items.filter((_, i) => {
    const row = existingContents[i] as unknown as { deletedAt?: number } | undefined;
    if (!row) return true;
    if (row.deletedAt) skippedDeleted++;
    return false;
  });
  if (missingContents.length) await db.contents.bulkPut(missingContents);

  const existingCollections = await db.collections.bulkGet(collections.map((c) => c.id));
  const missingCollections = collections.filter((_, i) => {
    const row = existingCollections[i] as unknown as { deletedAt?: number } | undefined;
    if (!row) return true;
    if (row.deletedAt) skippedDeleted++;
    return false;
  });
  if (missingCollections.length) await db.collections.bulkPut(missingCollections);

  return { contentsAdded: missingContents.length, collectionsAdded: missingCollections.length, skippedDeleted };
}
