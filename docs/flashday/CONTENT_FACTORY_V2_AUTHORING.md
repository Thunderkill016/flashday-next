# Content Factory V2 — Authoring Guide

## Where lessons live

`src/lib/fd-content-v2/lessons/<track>-<n>.ts` exports `LessonSpec[]`.
`src/lib/fd-content-v2/index.ts` groups them into packs via `packManifest()`.

## Writing a lesson

```ts
spec({
  id: 'sv25', level: 'a1', track: 'survival',
  capabilities: ['greet-leave'],          // must exist in capabilities.ts
  title: '…', titleVi: '…',
  task: '…', context: '…', outcome: '…',  // learner-facing job
  input: {
    title: 'SV25 · …',
    text: '…dialogue or text…',           // contains every sourceSentence verbatim
    origin: 'authored',                    // or 'derived' + sourceRefId
    noteVi: '…VN explanation…',
  },
  targets: [
    target({
      id: 'sv25.t1',
      chunk: 'see you around',             // verbatim inside sourceSentence
      cueVi: 'hẹn gặp',                    // must NOT contain the chunk
      sourceSentence: 'A: See you around.',// verbatim inside input.text
      productionPattern: 'see you <around / later>.',
      transferContext: 'leaving a party',
      pronunciationNote: '…',              // required on listening/pronunciation targets
      contrastVi: '…',                     // L1 contrast — never quote the chunk
    }),
  ],
  transferTask: { prompt, promptVi, changesDimension }, // changed context, not name-swap
  recyclingFrom: ['sv01'],                 // optional recycling edges
  sourceRefs: [...SRC.functions],
  researchRefs: [...RES.functions],
})
```

## Rules the validator enforces

| code | rule |
|---|---|
| chunk-not-in-source | `chunk` must appear verbatim in `sourceSentence` |
| source-not-in-input | `sourceSentence` must appear in `input.text` |
| answer-visible | compiled cloze must mask the chunk (`___`) |
| cue-leaks-answer / support-leaks-answer | cueVi, pronunciationNote, contrastVi may not contain the chunk |
| derived-source-missing | `origin:'derived'` requires `sourceRefId` |
| derived-source-not-cited / derived-from-restricted | sourceRefId must be in sourceRefs and derivable class |
| audio-outside-listening | `audio`/`transcript` ladder steps only on listening/pronunciation |
| audio-source-undeclared | audio tracks must declare `audioSource` (default `tts-synthetic`) |
| target-count | 3–8 targets per lesson |
| graph-* / recycle-loop | no prerequisite cycles; recycling loops ≤4 |
| missing-track | library gate — every track present |

## Track → target kind

`spec()` auto-assigns `kind` from track (listening→listening, pronunciation→pronunciation, grammar-support→grammar) unless the author sets a more specific kind. Pronunciation targets inherit lesson-level `contrastVi`.

## Run the gate

```bash
node scripts/content-cli.ts validate   # must print PASS before commit
node scripts/content-cli.ts inspect sv01
```
