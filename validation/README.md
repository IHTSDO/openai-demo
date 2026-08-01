# Validation harness — SympTEMIST (Spanish gold standard)

Measures the entity-extraction pipeline against a gold-standard annotated corpus.
First target: **SympTEMIST** (BioCreative) — Spanish clinical symptoms/signs
normalized to SNOMED CT (subtask-2 linking: span + code + relation).

Corpus text is **not** stored here (licensing). Point the scripts at your local
copy of the SympTEMIST release.

## Flow (script-first)

1. **Select** N docs and extract gold: read `symptemist_tsv_train_subtask2.tsv`
   plus the matching `es-<id>.txt` files → `symptemist_10.json`
   (`[{docId, text, gold:[{span_ini,span_end,text,code,sem_rel}]}]`).
2. **Run the pipeline** on each doc's text (drive the app or the service) →
   `ours.json` (`[{docId, entities:[{text, code, display}]}]`).
3. **Evaluate**: `node symptemist_eval.mjs symptemist_10.json ours.json out.md "<config note>"`.

## What the evaluator does (`symptemist_eval.mjs`)

- **Span alignment**: matches each gold mention to the best token-overlapping
  extracted entity (accent-insensitive).
- **Subsumption-aware code comparison** via FHIR `CodeSystem/$subsumes`
  (`FHIR_BASE` env, default demo Snowstorm). Because the pipeline codes
  *equivalent-or-more-general* by design, the outcome is graded, not exact-only:
  - `equivalent` → **exact**
  - `subsumes` (ours is an ancestor of gold) → **more-general** (acceptable)
  - `subsumed-by` (ours is a descendant) → **more-specific** (over-specific ✗)
  - else → **other** (different branch / not related on this edition)
- Writes an aggregate + per-doc + discrepancy-table markdown.
  > Note: `$subsumes` returns its outcome in `valueString`.

## Known limitations (see RESULTS caveats)

- `$subsumes` only relates ancestor/descendant, so **sibling equivalents**
  (e.g. "Fever" vs "Increased body temperature") score as "other" and undercount
  accuracy — add a synonym/equivalence check.
- SympTEMIST gold uses the **Spanish edition**; national-extension codes can't be
  related by an **International** server — run `$subsumes` on a Spanish-edition
  server (available via the Snowstorm MCP).

## Latest results

See [RESULTS-symptemist.md](RESULTS-symptemist.md). Headline (10 docs, agent off,
International server): detection recall **88%**; acceptable code (exact +
more-general) **≥32%** of detected (lower bound). Main finding: **Spanish
anatomical/specific terms drift to wrong-branch English concepts** — the top ES
fix, best attacked by the agent + Spanish-aware retrieval.

## Future: real-time Angular component

Bundle N docs + gold as an asset, run the pipeline live, and show a scoreboard
(detection / exact / acceptable, per-doc drill-down, discrepancy list) that
re-runs on algorithm changes — a regression dashboard. The script here validates
the methodology first.
