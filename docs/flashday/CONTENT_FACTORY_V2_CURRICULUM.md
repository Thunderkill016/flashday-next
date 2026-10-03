# Content Factory V2 — Curriculum Map

142 lessons · 893 targets · 877 unique chunks · 4 versioned packs.

## Tracks

| track | lessons | level | strand |
|---|---|---|---|
| survival | 24 | a0–a1 | essential interaction: greet, introduce, clarify, request, emergencies |
| everyday | 24 | a1–a2 | routines, plans, shopping, travel, problems, opinions, appointments |
| chunks | 18 | a2 | formulaic sequences: hedges, transitions, agreement, story frames |
| grammar-support | 12 | a1–a2 | grammar behind tasks: be, questions, past, modals, articles, prepositions |
| review | 8 | a1–a2 | spaced recycling in changed contexts (rv01–rv08) |
| listening | 16 | a2 | bottom-up decoding: boundaries, weak forms, reductions, numbers, signposts |
| pronunciation | 16 | a1–a2 | VN contrasts: final -s/-ed, θ/ð, tense-lax vowels, R/L, V/B, clusters, stress, intonation |
| developer | 24 | a2 | standup, bugs, reviews, PRs, deploys, incidents, meetings, async writing |

## Packs

| pack | lessons | tracks | dependsOn |
|---|---|---|---|
| flashday-core-a1-v1 | 48 | survival, everyday | flashday-foundation-v1 |
| flashday-core-a2-v1 | 35 | chunks, grammar-support, review (rv01–rv05) | foundation, core-a1 |
| flashday-listening-v1 | 33 | listening, pronunciation, review (rv08) | foundation, core-a1, core-a2 |
| flashday-developer-v1 | 26 | developer, review (rv06–rv07) | foundation, core-a1, core-a2 |

Review lessons live in the pack whose material they recycle so every
`recyclingFrom` edge resolves inside the pack or its declared deps:

- rv01–rv05 → core-a2 (recycles survival/everyday/chunks/grammar language)
- rv06–rv07 → developer (recycles dv + chunks language)
- rv08 → listening (audio ladder, consolidates decoding skills)

## Recycling spine

- `review` lessons (rv01–rv08) re-contextualize chunks from survival/everyday/chunks/developer — declared via `recyclingFrom`.
- `rv08` consolidates listening skills — keeps `review` track but ships in the listening pack.
- Later lessons recycle earlier language inside tracks too (e.g. dv22 escalates dv06+dv21 vocabulary).

## Design rules held

- understand→output→correct→recall→apply preserved via existing TextCycle surfaces
- attempt before reveal: cloze always masked; cue Vi never leaks the chunk
- changed-context transfer: every lesson's `transferTask.changesDimension` states what genuinely changes
- VN support everywhere: noteVi per input, cueVi per target, promptVi per transfer, contrastVi on pronunciation targets
- perception/comprehension/production kept distinct on audio tracks; no ASR in mastery path; audio = declared `tts-synthetic` (no fake `audioRef`)
