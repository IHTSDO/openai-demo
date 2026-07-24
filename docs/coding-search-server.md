# A Purpose-Built Search Server for AI-Assisted SNOMED CT Coding

*Design note for a possible spin-off. This is scoping, not a committed plan; the
work would be a separate stage. It captures the motivation, the design, and the
evidence gathered while iterating on the "Entity extraction" demo.*

## Abstract

The entity-extraction demo binds each LLM-extracted mention to a SNOMED CT
concept through a cascade of queries against a general-purpose terminology server
(Snowstorm / FHIR `$expand`). That works well, but most of the residual errors
trace back to a single limitation: **we do not own the relevance ranking.** We
can only re-rank what the server returns, and we repeatedly hit the server's
quirks — a mediocre concept ranked first, a rare syndrome whose synonym happens
to contain the query phrase, an over-specific subtype preferred over the plain
generic. This note proposes a small, purpose-built search service, built directly
from the SNOMED CT RF2 release, that (a) indexes all descriptions for
synonym-aware lexical matching, (b) owns a tunable, explainable scoring function
tailored to coding, and (c) adds a semantic (embedding) layer for the paraphrase
gap that lexical matching cannot close. It is **not** a general terminology
server and does not attempt to replace Snowstorm; it is a specialised matcher for
AI-assisted coding.

## 1. Motivation — what the demo taught us

Iterating the client-side cascade against real notes (MTSamples "General
Medicine") surfaced a recurring taxonomy of failures. The important observation
is *where each one has to be fixed*:

| Failure mode | Example | Root cause | Fixable client-side? |
|---|---|---|---|
| Over-specific subtype ranked first | `venous thromboembolism` → "Thromboembolus of vein following surgical procedure"; `tattoos` → "Inflammation related to voluntary body tattooing"; `occupational exposure` → "…exposure to radiation" | server ranks a specific concept above the plain generic; we can only re-rank the returned page | Only with parche heuristics; needs a **genericity/prototypicality prior** |
| Phrase-in-synonym false hit | `low platelet count` → "HELLP syndrome"; `recent travel` → "Deep vein thrombosis…due to recent air travel" | the query is a substring of a long descriptive synonym of a specific concept, which then scores as a confident match | Needs a **specificity-by-substring penalty** we cannot express through the server |
| Synonym gap | `rash` → had to be rescued to "Eruption" via an extra `$lookup` round-trip | the match was on a synonym, not the preferred term; the server surfaces the PT | Solved cleanly by **indexing all descriptions** |
| Morphology | `hypertension` vs "Hypertensive disorder" | token coverage treated the variant as non-matching | Solved (shared-stem coverage), but ad hoc |
| Recall miss | `sick contacts` → ∅ | no lexical description matches the phrasing | Needs **semantic (embedding) recall** |
| Semantic / polarity | `clear breath sounds` → "Harsh breath sounds" | antonym shares tokens | Hard for lexical **and** embeddings; needs the polarity guard we already built |

Two conclusions:

1. **The biggest lever is owning the ranking.** In a single note (#5), ~5 of 6
   errors were over-specificity or phrase-in-synonym mismatches — exactly the
   cases a general server ranks against us and a purpose-built scorer with a
   genericity prior would fix. This is a first-class scoring signal, not a patch.
2. **The remaining recall/paraphrase gap is an embeddings problem**, not a
   lexical one.

## 2. Feasibility — the RF2 release is small and self-contained

The International RF2 snapshot provides everything needed without FHIR:

- `sct2_Concept_Snapshot` (~360k active concepts; id, active, definitionStatus).
- `sct2_Description_Snapshot` (~1.2M active descriptions; term → conceptId, type
  FSN/synonym) — **the key asset** (~218 MB).
- `Refset/Language` (acceptability: preferred vs acceptable per description).
- `sct2_Relationship_Snapshot` (`is-a` = 116680003) — used **once per release** to
  precompute the transitive closure of the handful of top hierarchies we filter
  on (Clinical finding, Procedure, Product, Body structure). No ECL engine
  required for this use case.
- `Refset/Content` (optional) — reference sets usable as scoring priors (e.g.
  primary-care / IPS subsets).

Scale is modest: the description index fits in memory or a lightweight store
(SQLite FTS5, Tantivy, Lucene, or an in-process inverted index). Corpus size and
storage are not constraints.

## 3. Proposed architecture

```
RF2 snapshot --> ingest --> { concept table, description index (term->concept,
                              type, acceptability), transitive closure of the
                              4 filter hierarchies, optional refset tables }
                                |
                                +--> lexical index (normalized tokens,
                                |      stemming, trigram/fuzzy layer)
                                |
                                +--> vector index (embeddings of PT + synonyms,
                                       ANN e.g. hnswlib/faiss)

query: POST { text, clinicalTerm, generalTerm, type, context, synonyms[] }
   --> lexical candidates  --+
                             +--> unified scorer --> ranked concepts + explanation
   --> vector candidates  ---+
```

### 3.1 Scoring (owned and explainable)

The same signals we hand-built client-side, promoted to first-class server-side
ranking:

- exact / normalized-exact match on any description;
- token coverage (morphology-aware, shared stem);
- **genericity / prototypicality prior** — prefer the shorter, more generic
  concept over an over-specific subtype (fixes E1/E4/E6 above);
- **specificity-by-substring penalty** — down-weight a concept matched only
  because the query is a small substring of a long descriptive synonym (fixes the
  HELLP / "recent travel" class);
- preferred-term vs rare-synonym weighting (from the language refset);
- refset boost (e.g. concepts in a coding-relevant subset);
- polarity guard (reject a concept that adds an absence/negation word the query
  lacks) — already validated in the demo.

Every candidate is returned with *why* it scored as it did, which is exactly what
the demo's per-entity flow trace wants to show.

### 3.2 Query expansion

The LLM already emits `clinicalTerm` and `generalTerm` and could emit a short
list of synonyms/brand alternatives. The server accepts them and runs a single OR
query, scoring by the best-matching term — replacing today's sequential passes.

### 3.3 Semantic layer

Embed each concept (preferred term + synonyms) with a **local, open-source**
biomedical model and build an ANN index. Recommended first choice: **SapBERT**
(trained with contrastive learning on UMLS synonyms — built for exactly
"mention → concept" linking), with **BioLORD-2023** and general models
(BGE/E5/GTE, all-MiniLM) as alternatives. Notes:

- Embeddings are **model-specific**: corpus and query must use the same model;
  changing the model means re-embedding the corpus (minutes–hours, offline).
- **Cost is effectively zero at runtime** when run locally: a one-time corpus
  embedding per release, then one query embedding per lookup. (For reference,
  embedding the whole corpus via a hosted API would be a one-time ~$0.24; the real
  reason to go local is offline/no lock-in, not price.)
- Storage: ~360k × 384–768 dims × 4 bytes ≈ 0.5–1.1 GB; int8 quantization cuts it
  4×.
- Embeddings close the **synonym/paraphrase** gap (`sick contacts` ≈ "exposure to
  communicable disease"; `shortness of breath` ≈ "dyspnea"). They do **not**
  reliably solve antonyms (antonyms often sit close in embedding space), so the
  lexical polarity guard stays necessary.

Final ranking is a **hybrid**: lexical ∩ vector candidates, reranked by the
owned scorer, with the LLM available in the loop for tie-breaks.

## 4. Scope discipline and trade-offs

- **In scope:** a matching service for AI-assisted coding — mention in, ranked
  concepts + explanation out. Deterministic, offline, fast, reproducible for
  evaluation.
- **Out of scope:** general ECL, authoring, multi-edition browsing, subsumption
  services. If those are needed later, Snowstorm still wins and the two can
  coexist (Snowstorm for general terminology, this service as a specialised
  coding endpoint).
- **Maintenance:** re-ingest per SNOMED release (twice a year for International);
  straightforward.
- **Editions/languages:** this note assumes International; extensions and
  national refsets add ingest work but no design change.
- **Licensing:** distributing SNOMED CT content requires an affiliate licence
  (routine for IHTSDO).

## 5. Suggested phasing (for when it starts)

1. **MVP** — RF2 ingester → description index + transitive closure of the four
   filter hierarchies → `POST /match` returning ranked candidates with
   explanations. Effectively *move the demo's cascade into the server*, where the
   scoring is owned, tunable, and fast. Reuse the MTSamples notes + the drift
   taxonomy from the demo as the evaluation set.
2. **V2** — add the embedding layer (SapBERT) and hybrid reranking; add refset
   priors.
3. **V3** — LLM-in-the-loop disambiguation for the hardest ties; polarity/negation
   as an explicit semantic check.

## 6. Evidence base

This proposal is grounded in the demo's measured behaviour: the matching cascade,
its confidence guardrail, the synonym-lookup rescue, the polarity guard, and the
"trust the server's ranking" change are all documented in
[entity-extraction.md](entity-extraction.md), and the failure taxonomy in §1 comes
from running the pipeline over the first ten MTSamples "General Medicine" notes.
The single strongest, generalisable finding is that **owning the relevance
ranking — with a genericity prior and a specificity-by-substring penalty — would
prevent the majority of the residual errors**, which is the core reason to build
this service.
