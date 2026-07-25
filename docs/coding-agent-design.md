# AI-Assisted SNOMED CT Coding — Three Designs and a Shared Retrieval Strategy

*Design note for the coding spin-off. Compares three ways to build an automatic
coder, and describes the generalization-ladder retrieval strategy that all of
them should use. Companion artifacts: [`skills/snomed-coder/SKILL.md`](../skills/snomed-coder/SKILL.md)
(the portable policy) and [`tools/mcp-fhir-terminology/`](../tools/mcp-fhir-terminology/)
(the portable FHIR tools). Background: [entity-extraction.md](entity-extraction.md),
[coding-search-server.md](coding-search-server.md).*

## 0. The two kinds of heuristics

Everything we learned splits cleanly in two, and each half belongs in a
different place:

- **Deterministic (algorithm)** — the search cascade, scoring by server rank /
  coverage, the polarity guard, dose-form normalization, the confidence gate,
  skipping raw measurements. Reproducible, testable, cheap → belongs in **code**.
- **Judgment (policy)** — the subsumption rule (code *equivalent-or-more-general*,
  never *more-specific*), rejecting an off-topic concept, "an honest ∅ beats a
  wrong code". → belongs in a **prompt/policy** the LLM applies.

Putting scoring in a prompt makes it expensive and non-deterministic; hard-coding
clinical judgment makes it brittle. The three designs below differ mainly in
*how much* they lean on code vs. on the LLM.

## 1. Design A — deterministic pipeline + gated LLM review (what we built)

Phase 1 LLM extraction → Phase 2 deterministic terminology cascade (Snowstorm
`$expand`/`$lookup`, server-rank-first scoring, guards) → Phase 3 **gated** LLM
review that only re-checks *suspicious* matches and can reject to ∅.

- **Strengths:** cheap, fast, reproducible, fully auditable (per-entity trace).
  Resolves ~80% (diagnoses, drugs, clear findings) with almost no LLM cost.
- **Limits:** the gate misses *low-lexical-signal* semantic errors (`Benign` →
  "Adenoma", `DJD of spine` → "Osteoarthritis of joint of hand"); recall is
  capped by what the server returns; combination products and dose-form names
  cause noise.

## 2. Design B — purpose-built hybrid search server (RF2 + embeddings)

A local index over the SNOMED CT RF2 release: lexical index over all
descriptions + a vector index (e.g. SapBERT) + an owned, tunable scorer. See
[coding-search-server.md](coding-search-server.md).

- **Strengths:** we own the ranking (genericity prior, specificity penalty);
  synonym-aware; embeddings close the paraphrase/recall gap; deterministic,
  offline, reproducible.
- **Limits:** real infrastructure — RF2 ingest per release, an index, embeddings.
  A separate build stage, not a quick experiment.

## 3. Design C — FHIR agent (this note's focus)

Just an **LLM agent + a FHIR terminology API** (`$expand`, `$lookup`). No local
index, no scoring code. The agent reads the note, and for each mention drives the
search itself, judging semantic drift in real time and asking the server for more
options when needed. Shareable as a **Skill** (the policy) + an **MCP server**
(the two FHIR tools) — no custom web service.

- **Strengths:** the LLM *sees and judges every candidate*, so it catches the
  low-signal semantic errors Design A misses; it can re-query for better options
  (recall by broadening); minimal code; **portable** (any MCP-capable agent).
- **Limits:** cost/latency (many tool calls × reasoning), non-determinism, harder
  to audit, depends on a strong judge model, and the recall *ceiling* still
  applies — the agent cannot pick a concept the API never returns for any query.

## 4. The shared retrieval strategy — a monotonic generalization ladder

All three designs should retrieve the same way, because it enforces the
subsumption rule *at search time*: **never search for something more specific
than the mention.** That kills the #1 drift cause at the source (you cannot land
on "Renal hypertension" / "HELLP" / "at low risk of…" if you never search below
the mention's specificity).

The agent generates search statements in order of increasing generality:

| Rung | What | Example |
|---|---|---|
| **0 — same meaning** | synonyms, clinical rewording, spelling fix, expand abbreviation, US↔intl drug name, lay→clinical | "low platelet count" → "thrombocytopenia"; "HTN" → "hypertension"; "Plavix" → "clopidogrel" |
| **1 — slightly more general** | drop ONE qualifier (laterality, severity, site, cause) | "bilateral pelvic masses" → "pelvic mass"; "left frontal headache" → "headache" |
| **2+ — progressively general** | head noun / parent category | "pelvic mass" → "mass"; "DJD of the spine" → "degenerative joint disease" (never "OA of hand") |

Rules:
- **Accept the most specific faithful hit** — the lowest rung that returns a
  concept equivalent to the mention; then stop.
- **∅ if even the broadest still-faithful rung fails** — better than a wrong code.
- **Confidence = rung depth.** A rung-0 hit is high confidence; a rung-3 hit lost
  detail → lower confidence → route to human review.
- **Provenance for free:** "matched at generalization level 2 (dropped laterality
  + site)".

### Two engines for generalization
1. **Lexical (LLM):** the model emits the ordered list of broader terms. This is
   just our existing `clinicalTerm` (rung 0) and `generalTerm` (rung 1),
   generalized to N rungs.
2. **Structural (ECL ancestors):** anchor a seed concept (rung 0), then walk *up*
   the `is a` hierarchy with ECL `>` (ancestors) and pick the **most specific
   ancestor still faithful** to the mention. Uses SNOMED's own subsumption
   instead of guessing broader words.

The **hybrid** is best: lexical rung 0 to anchor a seed, then structural
generalization up the real hierarchy.

### Where judgment is still required
- **The floor:** how far to generalize before it becomes clinically useless
  ("mass" may be fine; "abnormality" is not). The judge decides per rung.
- **Ancestor faithfulness:** a more-general candidate is not automatically faithful
  (a parent may also cover unrelated concepts). Validate each pick.

## 5. Comparison

| | A — pipeline | B — RF2 server | C — FHIR agent |
|---|---|---|---|
| Cost / latency | Low | Low | High |
| Determinism / audit | High | High | Low–medium |
| Semantic-drift catch | Gated only | Good | Best |
| Recall ceiling | Server | Owned (best) | Server |
| Infra | None extra | RF2 + index + embeddings | None (public FHIR) |
| Portability / shareable | In-app | Service | **Skill + MCP (any agent)** |
| Time to build | Built | Weeks | Days (PoC) |

## 6. Recommendation

- **Ship Design A** for the reproducible, auditable core (done).
- **Prototype Design C now** as a shareable Skill + MCP — cheapest to try, best on
  the hard semantic drift, and it validates the generalization ladder end-to-end.
- **Invest in Design B** when recall/ranking must be owned at scale.
- **Long term, hybrid:** Design A/B fast path for clean cases + a Design-C
  *agentic review* (that can re-query FHIR) for the uncertain/gross ones.
- **Always:** attach provenance to every code and route low-confidence to a human.
  Never auto-submit codes for billing/CDS without review.
