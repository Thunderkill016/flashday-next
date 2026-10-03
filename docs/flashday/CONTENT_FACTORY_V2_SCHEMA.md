# Content Factory V2 — LessonSpec Schema

`specVersion: 'lesson-spec/v2'` · `version: 'content/2.0.0'`
Full types: `src/lib/content-factory/types.ts`.

## LessonSpec

| field | type | consumer | notes |
|---|---|---|---|
| id | string | — | stable, kebab (`sv01`) |
| specVersion | `'lesson-spec/v2'` | validator | schema pin |
| version | `'content/2.x'` | manifest | content version |
| level | `'a0'|'a1'|'a2'|'b1'` | compile→difficulty | a0/a1→beginner, a2→intermediate |
| track | TrackIdV2 | compile→collection | one of 8 tracks |
| capabilities | string[] | coverage | ids in `capabilities.ts` |
| title/titleVi | string | compile→title | `ID · title` |
| task/context/outcome | string | compile→text/metadata | learner-facing job |
| input.title/text | string | compile→article text | text carries sourceSentences |
| input.origin | `'authored'|'derived'` | validator | derived needs sourceRefId |
| input.sourceRefId | string? | validator→provenance | exact backing source |
| input.noteVi | string | compile→vi block | VN support text |
| targets | LessonTarget[] | compile→word items | 3–8 |
| supportLadder | SupportStepV2[] | carried-contract | audio/transcript only on audio tracks |
| reviewVariants | ReviewVariantV2[] | carried-contract | maps to vocab modes |
| transferTask | {prompt,promptVi,changesDimension} | compile→text + validator | changed-context requirement |
| truePrerequisites | string[] | graph/validator | hard ordering edges |
| prerequisiteRationale | Record<string,string>? | validator | authored evidence per hard edge — never auto-generated |
| recommendedAfter | string[] | graph | soft ordering edges |
| recyclingFrom | string[] | graph/recycling | chunk reuse edges |
| audioSource | `'tts-synthetic'|'recorded'|'source-audio'` | carried-contract | required on audio tracks |
| audioRef | string? | carried-contract | real asset backing recorded/source-audio; forbidden on tts-synthetic |
| sourceRefs | string[] | validator/coverage | registered source ids |
| researchRefs | string[] | validator/coverage | registered research ids |

## LessonTarget

| field | consumer | notes |
|---|---|---|
| id | — | `lessonId.tN`, globally unique |
| kind | TargetKind | chunk/vocabulary/grammar/listening/pronunciation |
| chunk | compile→word.title | verbatim in sourceSentence |
| cueVi | compile→cloze cue | never contains chunk |
| sourceSentence | compile→cloze | verbatim in input.text |
| productionPattern | carried (metadata.fd) | `pattern <slots>` |
| transferContext | carried (metadata.fd) | changed-context description |
| pronunciationNote | compile→vocabulary.pronunciation | heard-form hint (audio tracks) |
| contrastVi | carried-contract | L1 contrast, never the chunk |

## Field-consumer classes

`FIELD_CONSUMERS` (types.ts) marks every field `runtime-consumed` / `validator-consumed` / `carried-contract` — the lesson-level fix from FD-CONTENT-01 review: a field either reaches a rendered surface or is honestly labelled contract data.

## PackManifest (compiler output)

`packManifest(packId, version, lessons, deps, builtAt)` → `{ packId, version, schemaVersion, lessonIds, targetIds, dependencies, sourceManifestVersion, builtAt, compilerVersion }` — sorted ids, stable across wording edits.
