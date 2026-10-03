/* NDJSON helpers — append-free deterministic corpus files. */
import { readFileSync, writeFileSync } from 'node:fs';

export function readNdjson<T>(path: string): T[] {
  try {
    return readFileSync(path, 'utf8')
      .split('\n')
      .filter((l) => l.trim())
      .map((l) => JSON.parse(l) as T);
  } catch {
    return [];
  }
}

export function writeNdjson<T>(path: string, rows: T[]): void {
  writeFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
}

/* generated JSON artifacts — always newline-terminated (repo lint) */
export function writeJson(path: string, data: unknown): void {
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}
