# Entity extraction — modernization handoff

Working notes for continuing the incremental modernization of the
**"Entity extraction with LLM Chains"** tab (`app-nlp-function`, the one titled
"using API Functions"). Scope is limited to that tab unless noted.

## Done so far

- **Error handling** — every OpenAI-calling tab stops its spinner and shows a
  clear message on failure. `OpenaiService.describeOpenAiError()` maps SDK
  errors (connection / 401 / 429 / 404 / 5xx) to actionable text.
- **Modern OpenAI API** — entity extraction uses **Structured Outputs**
  (`response_format: json_schema`, strict) via `OpenaiService.extract()`.
- **Single model: `gpt-5-mini`** across the whole app. GPT-5 gotchas baked in:
  no `temperature` (rejected), use `max_completion_tokens` (not `max_tokens`).
  The legacy `completion()` was made GPT-5-compatible for the other tabs.
- **Cleanup** — removed dead `nlp` + `playground` components, the model-switch
  UI in the "OpenAI API" tab, and stale pricing/model fields. Cost is computed
  with real gpt-5-mini rates (0.25 in / 2.00 out per 1M) in `computeCost()`.
- **Progress UX** — phased status messages, total elapsed time, real cost, and
  a "Using AI cache" indicator (`extract()` returns a `cached` flag).

## Key files

- `src/app/services/openai.service.ts` — `extract()` (structured outputs),
  `completion()` (plain text, other tabs), `computeCost()`, `describeOpenAiError()`.
- `src/app/nlp-function/nlp-function.component.ts` — the extraction pipeline:
  LLM extract → per-entity terminology match → build CTUF expression.
- `src/app/services/terminology.service.ts` — `matchText()` FHIR `$expand`
  against Snowstorm (`snowstorm.ihtsdotools.org`).

## Current flow (what to improve)

1. **LLM extraction** — one `extract()` call returns `terms[]` (text, type,
   context, fsn, singularFsn, severity, laterality).
2. **Terminology match** — for each entity, one FHIR `$expand` with `count=1`
   (top-1 only), accepted if Levenshtein distance `< 50`.
3. **Post-process** — filter no-match, dedupe by text, render table + highlights.

## Next steps (not started)

- **Step 2 — real matching chain (biggest precision win):** fetch multiple
  candidates from the terminology server (today `count=1`) and add an LLM
  disambiguation pass to pick the right concept. Mirrors the referenced repo
  `IHTSDO/llm-chain-entity-extraction`.
- **Tighten acceptance:** Levenshtein `< 50` is far too loose.
- **Parallelize** the per-entity terminology lookups (today sequential
  `asyncForEach` with `await`).
- **Cache versioning:** old localStorage `cache` entries predate new result
  shapes (e.g. missing `cost`); consider a cache-key version to auto-invalidate.

## Environment notes

- OpenAI key lives in `localStorage['tempDataSct']` (JSON-encoded, so quoted in
  raw storage). localStorage is per-origin — localhost and GitHub Pages have
  separate keys. Set/clear it in the "OpenAI API" tab.
- Angular 20 app. `npm start` → dev server on `http://localhost:4200`.
