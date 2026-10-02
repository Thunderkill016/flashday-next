/*
 * Seeds flashday-foundation-v1 into the existing content pipeline.
 *
 * Deterministic ids make the seeder self-idempotent: a second run finds
 * every key present and writes nothing. Unlike the VS01 dogfood fixture,
 * this pack is real curriculum — if a learner deleted an item (deletedAt
 * set) we do not resurrect it; their choice survives reseeds.
 *
 * The pack is unconditional (not gated behind a flag): these are authored
 * product lessons, not experiment fixtures.
 */
import { db } from '@/lib/db';
import { FD01_LESSONS, fd01Collections, fd01ContentItems } from './pack';
import { type PackIssue, validatePack } from './validate-pack';

export interface Fd01SeedResult {
  contentsAdded: number;
  collectionsAdded: number;
}

/**
 * Validates the pack, then writes missing rows. Throws with the issue
 * list if validation fails — broken pack data must never reach the DB
 * (fail-closed rights/content gate, eslint2-rights).
 */
export async function seedFdContentPack(now: number): Promise<Fd01SeedResult> {
  const issues = validatePack(FD01_LESSONS);
  if (issues.length) {
    const summary = issues.map((i: PackIssue) => `${i.id}:${i.code}`).join(', ');
    throw new Error(`FD-CONTENT-01 pack failed validation (${issues.length}): ${summary}`);
  }

  const contents = fd01ContentItems(now);
  const existingContents = await db.contents.bulkGet(contents.map((c) => c.id));
  const missingContents = contents.filter((_, i) => !existingContents[i]);
  if (missingContents.length) await db.contents.bulkPut(missingContents);

  const collections = fd01Collections(now);
  const existingCollections = await db.collections.bulkGet(collections.map((c) => c.id));
  const missingCollections = collections.filter((_, i) => !existingCollections[i]);
  if (missingCollections.length) await db.collections.bulkPut(missingCollections);

  return { contentsAdded: missingContents.length, collectionsAdded: missingCollections.length };
}
