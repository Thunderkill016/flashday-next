# Tech-Books Repository Research Audit

Source repository: FatoomRe/Tech-Books
Role: technical research discovery library, not learner-facing content source.

## 1. Repository character

The repository is a large public collection of technical-book PDFs across AI, Data Science, UI/UX, Web, Mobile and software engineering.
Several filenames and README links reference redistribution sources such as z-lib.org, PDFDrive or other mirrors.

Therefore:

GitHub availability != reuse permission

Use the repository for title discovery, then prefer official/current sources for actual technical research when available.

## 2. Highest-value references for FlashDay

### Speech and Language Processing

Repo path: AI Books/speech and language processing.pdf

This is the most directly useful title for FlashDay speech/NLP work.
For current research, prefer the official Jurafsky & Martin third-edition manuscript at https://web.stanford.edu/~jurafsky/slp3/.

Relevant chapters:
- Phonetics and Speech Feature Extraction
- Automatic Speech Recognition
- Text-to-Speech
- Information Retrieval and RAG
- Conversation and its Structure

### Human-centered interaction design

Relevant repo titles include:
- Field Guide to Human-Centered Design
- Human Computer Interaction
- The Elements of User Experience

For the Field Guide, prefer the official IDEO/Design Kit version.

## 3. Speech findings

### Orthography, phones and acoustics are separate representations

FlashDay should keep explicit links among:
- written form
- accepted pronunciation variant
- phone sequence
- acoustic realization

This supports the existing decision not to treat ASR transcript text as pronunciation evidence.

### Articulatory features should drive corrective feedback

Useful dimensions include place of articulation, manner of articulation and voicing.
This enables concrete Vietnamese-specific feedback instead of opaque sound scores.

### Prosody is multi-dimensional

Prosody uses acoustic dimensions including F0/pitch, energy and duration and can signal prominence, discourse structure, affect and turn-taking.

Future speaking evidence should separate at least:
- segmental pronunciation
- word stress/prominence
- timing/rhythm
- intonation
- pause/fluency

Do not collapse these into one speaking score.

### Spectral features are evaluator inputs, not mastery

Spectrograms, MFCC-like features and other signal representations may support models and diagnostics.
They must not directly become learner-facing mastery claims.

Pipeline:
waveform -> acoustic features -> calibrated evaluator -> interpretable feedback

not:
feature distance -> pronunciation mastery

### ASR accuracy is not pronunciation quality

ASR is evaluated using transcript-oriented metrics such as word error rate.
That metric measures recognition error against a reference transcript, not pronunciation quality.

Therefore:
ASR transcript correct != pronunciation correct
ASR transcript wrong != necessarily learner pronunciation failure

### Transcript equivalence requires normalization

Speech-recognition evaluation commonly normalizes equivalent forms such as contractions, filled pauses, numbers/dates and spelling conventions.
FlashDay must not use raw exact-string equality as a speaking evaluator.

### Accent and recording conditions matter

Recognition quality varies with accent/dialect and microphone/noise conditions.
The future speech bake-off must include Vietnamese-accented English, phone microphones and realistic environments.

### Streaming is a product-quality dimension

For conversation tasks benchmark:
- partial-result latency
- stable-final latency
- endpointing
- revision behavior
- CPU/battery
- offline feasibility

WER alone is insufficient.

### TTS needs perceptual evaluation

TTS should be judged not only by whether synthesis succeeds but by intelligibility, pronunciation correctness, accent consistency, prosody, pacing and educational suitability.
VOA real audio and TTS should remain distinct source types.

## 4. Conversation findings

Conversation is structured around turn-taking, grounding and repair.

Future speaking tasks should support repair chains such as:
learner attempt -> clarification request -> learner repair/rephrase -> evidence chain

A repair is pedagogically meaningful and should not automatically be treated as an unrelated second attempt.

## 5. Retrieval/RAG implication

Retrieval should supply candidate knowledge or material, never authority.

Examples:
- retrieved lexical fact != rights-cleared fact
- retrieved history record != capability truth
- RAG output != learner evidence

This aligns with FlashDay's evidence/provenance doctrine.

## 6. Human-centered design implication

Design research supports the product loop:
research -> small learner journey -> dogfood -> observe friction -> revise

Important learning-UX questions:
- Does the learner know what to do next?
- Does feedback lead to a concrete retry?
- Is support honest about independence contamination?
- Can the learner resume after interruption?
- Does the system fail honestly when a modality is unavailable?

## 7. What not to read now

Do not spend time on unrelated 3D printing, drones, game development, generic old framework books or broad cybersecurity material unless a concrete FlashDay problem requires them.

## 8. Rights classification

Register FatoomRe/Tech-Books as:
sourceKind = TECHNICAL_RESEARCH_DISCOVERY
rightsClass = REFERENCE_ONLY / PER-WORK
learnerFacing = false

## 9. Development impact

Immediate implications for M3 speech:
- include Vietnamese accent/noise/latency in the bake-off
- separate ASR observation from pronunciation authority
- model prosody in multiple dimensions
- use articulatory features for corrective feedback
- model conversational repair
- reuse lexical regional forms/IPA instead of creating a separate speech dictionary

## 10. Key principle

recognition != pronunciation
acoustic measurement != pedagogical judgement
model output != learner truth