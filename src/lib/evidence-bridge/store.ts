/*
 * Dexie adapter for the kernel event-store surface.
 *
 * Mirrors store-memory.js semantics over the real IndexedDB table:
 *   append(events) → { appended, deduped }
 *     identical re-delivery dedupes; same id + different content throws
 *     — evidence identity is not last-write-wins.
 *   list() → events sorted by (occurredAt, id) — canonical replay order.
 */
import type { Table } from 'dexie';
import { eventFingerprint } from '@/vnext/store-memory';
import type { EventStore, EvidenceEvent } from './types';

const conflict = (id: string) =>
  new Error(`event conflict '${id}' — same id, different content; refusing to overwrite evidence`);

export function createDexieEventStore(table: Table<EvidenceEvent, string>): EventStore {
  return {
    async append(events) {
      let appended = 0;
      let deduped = 0;
      for (const event of events) {
        const existing = await table.get(event.id);
        if (existing) {
          if (eventFingerprint(existing) !== eventFingerprint(event)) throw conflict(event.id);
          deduped++;
          continue;
        }
        try {
          await table.add(event);
          appended++;
        } catch (err) {
          /* get→add is not atomic: a concurrent writer may have landed
           * the same id between the check and the insert. Re-read and
           * apply the same rule — identical is a dedupe, different is a
           * refusal, gone is the original error. */
          const raced = await table.get(event.id);
          if (raced && eventFingerprint(raced) === eventFingerprint(event)) {
            deduped++;
            continue;
          }
          if (raced) throw conflict(event.id);
          throw err;
        }
      }
      return { appended, deduped };
    },
    async list() {
      const events = await table.toArray();
      return events.sort((a, b) => a.occurredAt - b.occurredAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    },
  };
}
