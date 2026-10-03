/*
 * Content Factory CLI (Part 10) — solo-developer workflow.
 *   node scripts/content-cli.ts <cmd> [args]
 *     inventory            source/research manifest summary
 *     validate             full QA gate on the V2 curriculum
 *     compile              compile packs -> reports (dry-run, no DB)
 *     coverage             machine + human coverage report
 *     inspect <lesson-id>  one lesson: refs, rights, runtime map, issues
 *     quality              duplicate/quality analysis
 *     recycling            chunk lifecycle report
 *     build                all of the above -> content-corpus/reports/
 *     extract              re-derive knowledge layer from the corpus
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const REPORTS = join(ROOT, 'content-corpus/reports');

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  const { V2_PACKS, V2_LESSONS, CAPABILITIES } = await import('../src/lib/fd-content-v2/index.ts');
  const { validateLesson, validateLibrary } = await import('../src/lib/content-factory/validate.ts');
  const { compilePack } = await import('../src/lib/content-factory/compile.ts');
  const { coverageReport, coverageMarkdown } = await import('../src/lib/content-factory/coverage.ts');
  const { analyzeQuality } = await import('../src/lib/content-factory/quality.ts');
  const { recyclingReport } = await import('../src/lib/content-factory/recycling.ts');
  const { SOURCE_MANIFEST } = await import('../src/lib/content-factory/sources.ts');
  const { RESEARCH_MANIFEST } = await import('../src/lib/content-factory/research.ts');
  const { ALL_KNOWLEDGE } = await import('../src/lib/content-factory/knowledge/index.ts');
  const { FIELD_CONSUMERS } = await import('../src/lib/content-factory/types.ts');
  const { lessonOrder } = await import('../src/lib/content-factory/graph.ts');

  const allLessons = V2_LESSONS;
  const vctx = { knownCapabilities: new Set(Object.keys(CAPABILITIES)) };

  switch (cmd) {
    case 'inventory': {
      const byClass = (k: string) => Object.values(SOURCE_MANIFEST).filter((s) => s.klass === k);
      console.log(`sources: ${Object.keys(SOURCE_MANIFEST).length}`);
      for (const k of ['REUSABLE_CONTENT', 'LINK_AND_DERIVE', 'REFERENCE_ONLY', 'REJECTED'])
        console.log(
          `  ${k}: ${byClass(k).length} — ${byClass(k)
            .map((s) => s.id)
            .join(', ')}`,
        );
      console.log(`research: ${Object.keys(RESEARCH_MANIFEST).length}`);
      console.log(`knowledge entries: ${ALL_KNOWLEDGE.length}`);
      break;
    }
    case 'validate': {
      const issues = validateLibrary(allLessons, 'fd02', vctx);
      for (const i of issues) console.log(`${i.id}  ${i.code}  ${i.message}`);
      console.log(issues.length ? `FAIL ${issues.length} issues` : 'PASS');
      process.exitCode = issues.length ? 1 : 0;
      break;
    }
    case 'compile': {
      for (const pack of V2_PACKS) {
        const lessons = allLessons.filter((l) => pack.lessonIds.includes(l.id));
        const { report } = compilePack(pack, lessons, 0);
        console.log(
          `${pack.packId}: ${report.lessons} lessons, ${report.targets} targets, ${Object.keys(report.provenance).length} items`,
        );
      }
      break;
    }
    case 'coverage': {
      const report = coverageReport(allLessons, ALL_KNOWLEDGE, 'fd02');
      console.log(coverageMarkdown(report));
      break;
    }
    case 'inspect': {
      const id = args[0];
      const lesson = allLessons.find((l) => l.id === id);
      if (!lesson) {
        console.error(`lesson "${id}" not found`);
        process.exitCode = 1;
        break;
      }
      console.log(JSON.stringify(lesson, null, 2));
      const issues = validateLesson(lesson, vctx);
      console.log(
        issues.length
          ? `\nISSUES:\n${issues.map((i) => `  ${i.code}: ${i.message}`).join('\n')}`
          : '\nno validation issues',
      );
      console.log('\nfield consumers:');
      for (const [f, c] of Object.entries(FIELD_CONSUMERS)) console.log(`  ${f}: ${c}`);
      break;
    }
    case 'quality': {
      const qs = analyzeQuality(allLessons);
      for (const q of qs) console.log(`${q.kind}  ${q.message}  [${q.ids.join(', ')}]`);
      console.log(qs.length ? `${qs.length} quality issues` : 'clean');
      break;
    }
    case 'recycling': {
      const r = recyclingReport(allLessons);
      const never = r.filter((c) => !c.stages.includes('recycled'));
      console.log(
        `chunks: ${r.length}, recycled downstream: ${r.length - never.length}, never recycled: ${never.length}`,
      );
      for (const c of r.filter((c) => c.recycledBy.length).slice(0, 30))
        console.log(`  ${c.chunk}  [${c.stages.join('>')}]  recycled-by: ${c.recycledBy.join(', ')}`);
      break;
    }
    case 'build': {
      mkdirSync(REPORTS, { recursive: true });
      const issues = validateLibrary(allLessons, 'fd02', vctx);
      const cov = coverageReport(allLessons, ALL_KNOWLEDGE, 'fd02');
      const qs = analyzeQuality(allLessons);
      const rc = recyclingReport(allLessons);
      const compileSummary = V2_PACKS.map((p) => {
        const lessons = allLessons.filter((l) => p.lessonIds.includes(l.id));
        const { items, collections, report } = compilePack(p, lessons, 0);
        return {
          packId: p.packId,
          version: p.version,
          lessons: report.lessons,
          targets: report.targets,
          items: items.length,
          collections: collections.length,
        };
      });
      writeFileSync(join(REPORTS, 'validation.json'), JSON.stringify(issues, null, 2));
      writeFileSync(join(REPORTS, 'coverage.json'), JSON.stringify(cov, null, 2));
      writeFileSync(join(REPORTS, 'coverage.md'), coverageMarkdown(cov));
      writeFileSync(join(REPORTS, 'quality.json'), JSON.stringify(qs, null, 2));
      writeFileSync(join(REPORTS, 'recycling.json'), JSON.stringify(rc, null, 2));
      writeFileSync(join(REPORTS, 'compile-summary.json'), JSON.stringify(compileSummary, null, 2));
      writeFileSync(join(REPORTS, 'lesson-order.json'), JSON.stringify(lessonOrder(allLessons), null, 2));
      console.log(`reports written to ${REPORTS}`);
      console.log(`validation issues: ${issues.length} · quality issues: ${qs.length} · lessons: ${allLessons.length}`);
      process.exitCode = issues.length ? 1 : 0;
      break;
    }
    case 'extract': {
      execFileSync('node', [join(ROOT, 'scripts/extract-knowledge.mjs')], { stdio: 'inherit' });
      break;
    }
    default:
      console.log(
        'commands: inventory | validate | compile | coverage | inspect <id> | quality | recycling | build | extract',
      );
      process.exitCode = cmd ? 1 : 0;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
