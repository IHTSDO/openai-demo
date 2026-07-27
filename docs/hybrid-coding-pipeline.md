# The Hybrid Coding Pipeline — Deterministic Core + Agentic Tail

*How the "Entity extraction" demo actually codes a note today: a cheap,
reproducible deterministic pipeline that resolves the large majority of
mentions, plus an opt-in LLM agent that takes only the hard leftovers. This is
the concrete, shipped realization of the trade-offs discussed in
[coding-agent-design.md](coding-agent-design.md); background on the matching
rules is in [entity-extraction.md](entity-extraction.md).*

## Why hybrid

Two pure approaches each fail in a different way:

- **Pure deterministic** (LLM extraction + a fixed terminology cascade + scoring)
  is cheap, fast, reproducible and fully auditable — but it misses *semantic*
  drift the lexical layer can't see (a candidate that shares words but means
  something else) and it is capped by what a single search returns (recall).
- **Pure agentic** (an LLM driving the terminology API turn by turn) catches the
  semantic drift and can re-query for recall — but it is expensive, slower,
  non-deterministic, and harder to audit.

The hybrid keeps the strengths of both by **routing by difficulty**: the
deterministic core resolves the ~80% that are unambiguous at almost no LLM cost,
and the agent is spent only on the residual that the core leaves unresolved.

## The pipeline

```
Phase 1  LLM extraction        one call: note -> entities (dx / findings /
                               procedures / meds; skips raw measurements)
Phase 2  Terminology cascade   per entity: Snowstorm $expand/$lookup, server-rank
   (deterministic)             -first scoring, polarity & specificity guards
Phase 3  LLM review (gated)    one batched call: re-checks only "suspicious"
   (deterministic-ish)         matches; rejects off-topic/over-specific to ∅
--- fast path ends here for ~80% of entities ---
Phase 3b LLM agent (opt-in)    only for entities still unresolved: a tool-using
   (agentic)                   loop that searches, rewords, and walks ECL
                               ancestors until it finds a faithful concept or ∅
```

Control flow up to phase 3 is **code-directed** (a workflow). Phase 3b is
**model-directed** (a true agent — the LLM decides which tool to call, how to
reformulate, when to stop). See [coding-agent-design.md](coding-agent-design.md)
§6 for that distinction.

### Phase 1 — extraction
One structured-output LLM call turns the note into entities with `type`,
`context` (present/absent/unknown), and inline reformulations (`clinicalTerm`,
`generalTerm`). It deliberately **skips raw vital-sign and lab measurements** and
does not infer a finding from a value, which removes a whole class of noise and
value→wrong-finding drift.

### Phase 2 — deterministic cascade
For each entity, an escalating set of `$expand` searches (literal → normalized →
clinicalTerm → generalTerm → fuzzy/prefix), scored by **server relevance rank
first** (full Snowstorm ranks the correct generic highly), with morphology-aware
coverage, a synonym `$lookup` rescue, a **polarity guard** (reject a candidate
that adds an absence word the query lacks), and a fallback past a non-confident
top-ranked hit. Accepts equivalent/close concepts; leaves the rest unmatched.

### Phase 3 — gated LLM review
A single batched call reviews the matches, but only the **suspicious** ones (not
exact and carrying many extra qualifier tokens — the over-specific / off-topic
class). It keeps a match that is equivalent-or-more-general and rejects one that
is more specific, off-topic, or opposite in meaning, sending it to ∅. Clean
generics never reach the model, so its occasional over-abstention can't hurt
them. This is the key to using an LLM judge *reliably*.

### Phase 3b — agentic fallback (opt-in)
Only for entities still ∅ after phases 2–3. A tool-using loop
(`OpenaiService.chatWithTools` + `CodingAgentService`) gives the model two tools
— `expand` and `lookup` over the same Snowstorm server — and the coding policy.
It follows the **monotonic generalization ladder**: reword to the clinical term
(rung 0), drop a qualifier (rung 1), or walk up the SNOMED CT `is a` hierarchy
via ECL `>` ancestors — never searching more specific than the mention — and
either returns a faithful concept or an honest ∅. Each decision, with the tool
calls and rationale, is recorded in the entity's trace. Enabled by the Tuning
toggle **"Auto-coding agent for unresolved (intense LLM use)"** (default off).

## Economics

| Phase | LLM calls | Runs on | Cost profile |
|---|---|---|---|
| 1 Extraction | 1 | whole note | fixed, low |
| 2 Cascade | 0 | every entity | terminology HTTP only |
| 3 Review | 1 (batched) | suspicious matches | low |
| 3b Agent | N loops | unresolved only | ~$0.01–0.02/note, scales with leftovers |

The agent's cost is bounded because it never touches the easy majority. On the
demo notes it typically had 1–4 leftovers per note.

## Results (MTSamples General Medicine, agent on)

The agent reliably rescues hard **recall** cases the deterministic core left ∅,
and returns an honest ∅ on the genuinely uncodeable:

| Note | Total | Agent coded | Honest ∅ |
|---|---|---|---|
| #1 | 20/21 | `ventilatory support` → "Assisted breathing" | `IV antibiotics` (class + route) |
| #2 | 28/29 | `albuterol inhaler` → "Albuterol only product in pulmonary dose form"; `Tussionex…` → "Chlorpheniramine and hydrocodone only product"; `smoking history` → "Tobacco smoking behavior" | `antibiotics` (class) |
| #3 | 29/29 | `Strep test` → "Streptococcus pyogenes antigen assay"; `Water's View of the sinuses` → "Plain X-ray of nasal sinus, occipitomental view" | — |

Earlier standalone traces also showed it coding `venous thromboembolism` →
"Thromboembolism of vein" (via ECL ancestors, where the plain cascade returned
∅) and avoiding the classic traps (`low platelet count` ↛ "HELLP syndrome";
`Abdomen: benign` ↛ "Adenoma").

## Provenance and safety

Every entity carries a step-by-step trace (extraction → cascade steps → review →
agent), and each agent decision records its tool calls, the rung reached, a
confidence, and a one-line rationale. Confidence should drive **human review**:
rung-0 equivalents are high confidence; deep-ladder or structural-ancestor hits
are lower and should be checked. Codes are never auto-submitted for billing/CDS
without a human in the loop.

## Configuration (TuningService)

- `enableLlmRerank` (default on) — phase 3 gated review.
- `enableCodingAgent` (default **off**) — phase 3b agentic fallback (intense LLM
  use).
- plus the cascade knobs (coverage/distance thresholds, candidate count, synonym
  lookup, general-term/fuzzy/prefix passes).

## Implementation map

- `src/app/nlp-function/nlp-function.component.ts` — orchestrates phases 1–3b
  (`runNlp`, `matchWithSnomed`, `reRankWithLlm`, `runCodingAgent`).
- `src/app/services/openai.service.ts` — `extract` (structured output),
  `chatWithTools` (generic inline function-calling loop; no MCP).
- `src/app/services/coding-agent.service.ts` — the agent's tools + policy.
- `src/app/services/terminology.service.ts` — `$expand`/`$lookup` against
  Snowstorm (full Snowstorm by default; Lite selectable).

## Future work

- **Extend the agent to low-confidence matches**, not only ∅, to also correct
  over-specific-but-matched concepts (e.g. "occupational exposure" →
  "…exposure to radiation").
- **Cache agent decisions** keyed on (mention, model) for cheaper re-runs.
- **Design B** ([coding-search-server.md](coding-search-server.md)) — an owned
  RF2 + embeddings index — would raise the recall ceiling for the whole pipeline.
