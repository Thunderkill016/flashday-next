# FD-VS01 — Dogfood Runbook (product owner)

**Goal:** answer one question honestly — *after learning a chunk from a
real sentence, can you still produce and reuse it ≥24h later in a changed
context, without answer-bearing help?*

**Setup:** `pnpm dev`, open the app, stay signed out (anonymous local
learner is fine — everything is on-device). The five targets only seed
in development builds — a production/default install never receives them,
and `__vs01Report` only exists in `pnpm dev`.

**The 5 targets** (source: lesson *My Morning Routine*):

| Chunk | Pattern | Vietnamese cue |
|---|---|---|
| wake up at | wake up at \<time\> | thức dậy lúc ~ |
| a glass of | a glass of \<drink\> | một ly ~ (đồ uống) |
| leave the house | leave the house \<modifier\> | rời khỏi nhà |
| on the way | on the way \<to/place\> | trên đường (đến đâu đó) |
| feel ready to | feel ready to \<verb\> | cảm thấy sẵn sàng để ~ |

## Day 1 (~20 min)

1. Dashboard → find the lesson task for **My Morning Routine**
   (unit under *daily*), or open `/learn` and pick it.
2. **Understand:** read/listen; write the *comprehension* answer with a
   real quote from the text. Use translation only if you actually need it —
   that gets recorded honestly.
3. **Do not pre-memorize the five chunks.** First recall must be real.
4. Open the chunk unit: `/learn/unit%3Acategory%3Avs01-dogfood`
   (or find the *vs01-dogfood* wordbook under `/learn`). Attempt all five
   hidden-answer recalls. **Your first typed answer is the metric** —
   wrong answers may be retried, and the miss is recorded (history only;
   it does not change scheduling).
5. **Produce:** write your own response to the lesson (output), then a
   genuine revision (correct). Don't force the chunks in — whether you
   use them unprompted is the observation.
6. Note the time you finished.

## Day 2 (only when ≥24h from each chunk's first success)

1. Reopen `/learn/unit%3Acategory%3Avs01-dogfood`. Attempt all five
   recalls again. First answer counts; no peeking.
   - A chunk is *delayed-eligible* 24h after your **first successful**
     recall of it — check `delayedEligibleAt` in the report if unsure.
   - `/review/today` may surface them via FSRS — that is convenience, not
     the experiment clock.
2. Dashboard → the lesson now shows **Recall without the source** —
   write from memory, compare, rate honestly (an assisted recall is
   recorded as assisted and doesn't count).
3. **Transfer:** the lesson's *apply* stage — pick a source expression,
   describe a *different* situation (see the transfer column of the table
   above), write the new example. One apply attempt per chunk you want to
   count: set *Expression* to the exact chunk text.

## Day 3

1. Finish any missing delayed attempts (each still needs its own ≥24h).
2. Inspect the result — DevTools console:

   ```js
   await __vs01Report()
   ```

   → one JSON record per target (understanding, immediate recall,
   production, delayed recall, transfer, failureReason).

3. Write the failure memo: what failed, why, and which product change
   the observed failure justifies. No architecture proposals without an
   observed failure.

## Honesty rules

- No fake-clock claims — a real ≥24h gap or it doesn't count.
- "Assisted" is recorded and means *not a pass* for the pilot.
- Self-rating is evidence of what you remembered, not a mastery score.
- Translation/support use is fine — it just gets recorded as support.
