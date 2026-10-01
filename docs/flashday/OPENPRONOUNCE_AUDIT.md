# OpenPronounce audit — FDN-SPEECH-001 Part B

**Scope**: evaluate `Halleck45/OpenPronounce` as a candidate acoustic/pronunciation
authority for FlashDay Next. Audit only — no production integration, no model
weights or evaluation audio committed to this repository.

## Identity

| Field | Value |
|---|---|
| Repo | https://github.com/Halleck45/OpenPronounce |
| Pinned commit | `74bc17ea406e6f057f15eea0e70951e1931af868` (2026-08-15) |
| Package version | `openpronounce 0.3.0` (pyproject) |
| License | **MIT** — clean for commercial use |
| Python | `>=3.10` (3.10–3.12 classifiers) |

## Architecture

Two Wav2Vec2 checkpoints + deterministic alignment/scoring:

| Component | Implementation |
|---|---|
| Word transcription + embeddings | `facebook/wav2vec2-large-960h` (~1.2 GB), CTC head for text, `.wav2vec2` trunk for frame embeddings (`speech.py`) |
| Phone recognition | `facebook/wav2vec2-lv-60-espeak-cv-ft` (~1.2 GB), espeak-phone vocab, per-phone peak posterior = confidence (`phones.py`) |
| Expected phones | `phonemizer` (espeak-ng) over the reference text |
| Reference voice | TTS of the target sentence: gTTS (network) or offline `piper` (~60 MB/voice) / `kokoro` (~330 MB) |
| Acoustic distance | mean per-step DTW (fastdtw) distance between learner and reference Wav2Vec2 frame embeddings |
| Phone errors | Levenshtein alignment expected↔heard, near-phone costs (0.5), final-deletion/epenthesis costs, GOP-style plausibility gate (expected-phone posterior > 0.05 attenuates the flag) |
| Score | `0.3·acoustic + 0.4·PER + 0.3·WER`, each term clipped to [0,100] (`speech.py:330–355`) |

Word flagging: a word is flagged when per-phone error confidences sum to
≥40% of its phones **or** ≥2 edits (`PHONE_ERROR_THRESHOLD=0.4`,
`PHONE_ERROR_MIN_EDITS=2`).

**Dependencies**: torch (CPU wheels used in Dockerfile), transformers, librosa,
soundfile, scipy, scikit-learn, fastdtw, phonemizer, Levenshtein, gTTS.
**External binaries**: `ffmpeg`, `espeak-ng`, `libsndfile1` (apt).

## Runtime / deployment footprint

- Models download from the HF hub on first use into `$HF_HOME`
  (~2.4 GB combined); the official `Dockerfile` bakes them at image build.
- CPU-only by default (`device.py` picks CUDA if present — GPU is optional).
- Benchmark hardware context: torch 6 threads → **~3.0 s/utterance mean**
  (median 2.65 s, max 49.6 s on outliers) for a 2–12 word sentence; the
  benchmark's 500-utterance run took ~25 min end-to-end.
- Expected process RAM: two 1.2 GB checkpoints + torch runtime ≈ 3–4 GB
  resident per worker. Concurrency is process-bound, not request-bound.
- `server.py` (FastAPI): `POST /pronunciation` (file + expected_text →
  score, errors, prosody), `POST /speech2text`, `POST /phonemes`,
  `POST /tts`, `GET /languages`, `GET /health`. Stateful in-process model
  cache — single-process warm serving, no queueing layer.
- Privacy posture is good **if self-hosted**: learner audio stays inside
  our own container. Caveat: the default gTTS reference calls Google with
  the *text* (not audio); piper/kokoro make the whole path offline.

## Benchmark reproduction

The full inference path was **not** re-run: it requires downloading ~2.4 GB
of model weights, which this mission's constraints exclude. Instead the
committed result CSV (`benchmarks/results/speechocean762-v0.3.csv`,
500 stratified utterances, seed 0) was re-analyzed with a pure-Python
implementation of the documented 0.3.0 score formula — a real reproduction
of the *metrics pipeline*, not just quoted README numbers:

| Metric (vs human `total`) | README claim | Recomputed |
|---|---|---|
| score — Pearson / Spearman | 0.633 / 0.652 | **0.633 / 0.652** ✓ |
| score vs human accuracy | 0.603 / 0.631 | **0.603 / 0.631** ✓ |
| acoustic_distance | −0.638 / −0.666 | **−0.638 / −0.666** ✓ |
| phoneme_error_rate | −0.554 / −0.568 | **−0.554 / −0.568** ✓ |
| word_error_rate | −0.519 / −0.551 | **−0.519 / −0.551** ✓ |
| word-flag micro recall / precision | 0.732 / 0.196 | **0.732 / 0.196** ✓ |
| wall time per utterance | ~3.0 s | mean 3.01 s ✓ |

Per-speaker mean Spearman: README reports 0.825 over **106** speakers; the
CSV contains 123 speaker ids and recomputes to 0.813 — the difference is a
speaker-count/filter detail, not a contradiction (README predates the full
CSV or filtered thin speakers).

Also honest in the README itself: at the *word* level precision is 0.196 —
4 in 5 flagged words are **false alarms** under the human rubric. The
authors' own analysis: raters are lenient (90% of words score 10/10;
accent traits like ð→z, θ→s, ɪ→i, dropped finals are rarely penalized),
and recognizer confidence does not separate true from false alarms —
the GOP-style expected-phone posterior does part of that work.

## Vietnamese-accent pilot — BLOCKED, documented

No product-owned or consented Vietnamese-English audio corpus exists in
this repository, and no consented speakers were available to record the
30–50-utterance pilot set. Doing nothing was preferred over two bad
options: (a) fabricating results, or (b) pulling L2-ARCTIC/other
non-commercial datasets in as a product dependency (CC BY-NC — usable only
as research material, never a shipped asset or commercial threshold source).

What the benchmark evidence *does* say for this population: the validation
corpus is Mandarin-accented (SpeechOcean762). Word-level false-alarm rates
are already ~80% on a lenient rubric for traits that overlap with
Vietnamese learner phonology (θ→s, ð→z, dropped final consonants, lax↔tense
vowels). A Vietnamese pilot remains **required before any word-level claim
is trusted** — with human annotation as the reference labels.

## Comparison with the current path

| | OpenPronounce | SpeechSuper (integrated) | Current ASR (`/api/stt`) |
|---|---|---|---|
| Model | self-hosted Wav2Vec2×2 | commercial API (vendor GOP) | hosted Whisper-class ASR |
| Output | score + per-word/per-phone flags + prosody | overall/fluency/integrity + phoneme quality | transcript only |
| Privacy | best (offline-capable) | learner audio → vendor | learner audio → provider |
| Ops cost | +3–4 GB RAM service, Python sidecar | API call | already deployed |
| Authority class | acoustic evidence (unproven at word level) | vendor-claimed acoustic | **observation, never credit** |
| License | MIT | proprietary | provider terms |

## Limitations

- **Utterance-level, not phone-truth**: Spearman 0.65 is respectable for
  coarse scoring but far from authority-grade; per-word flagging carries
  an ~80% false-alarm rate on a lenient rubric.
- Accent sensitivity is explicitly acknowledged upstream; validation is
  Mandarin-accented only — Vietnamese behavior is unmeasured.
- The acoustic distance term is calibrated per language against bundled
  samples ("~6 clean native-like"); a Vietnamese speaker of good English
  may sit systematically above `acoustic_good=6` — bias risk needs the
  blocked pilot to quantify.
- Two heavy checkpoints + espeak-ng binary + torch: meaningful ops weight
  vs a typed/ASR path that already works.
- Reference voice quality (TTS) bounds the acoustic target — learner is
  compared to synthetic speech, not a human target.

## Recommendation: **EXPERIMENT MORE**

Legitimate claim today: **pronunciation diagnostic / feedback routing
signal** — utterance-level correlation with expert raters is real and
reproduced (ρ≈0.65), phone-level output is granular, MIT-clean, and
self-hostable with strong privacy. It can already power "which sound to
practice next" hints where a false positive costs a learner one drill,
nothing more.

Not legitimate yet: **evidence of independent pronunciation ability** —
word-level precision 0.20 means flagging a learner wrongly is the common
case, and Vietnamese-accented performance is unmeasured. Before promotion
toward an acoustic authority: run the blocked Vietnamese pilot (≥3
consented speakers, ≥30 utterances, human-annotated target errors),
measure per-phoneme precision/recall on our contrast set, and only then
consider gating any milestone on it. The `attempt.capture.authority='asr'`
gate shipped in Part A stays the boundary meanwhile: transcript evidence
never mints speech credit, and neither would OpenPronounce output until a
calibrated `authority` class exists for it.
