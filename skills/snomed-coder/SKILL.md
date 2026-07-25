---
name: snomed-coder
description: >-
  Bind clinical mentions in a free-text note to SNOMED CT concepts using a FHIR
  terminology server (ValueSet/$expand and CodeSystem/$lookup). Use when asked to
  code, encode, or map a clinical note, problem list, medication list, or a single
  clinical phrase to SNOMED CT codes. Requires the fhir-terminology MCP tools
  (`expand`, `lookup`). Codes to a concept equivalent to or more general than the
  mention, never more specific, and returns null when no faithful concept is found.
---

# SNOMED CT Coder

You assign SNOMED CT concept codes to clinical mentions extracted from a note,
using a FHIR terminology server through the `expand` and `lookup` tools. You are a
careful clinical coder: the codes feed analytics, quality measures, and clinical
decision support, so a wrong code is worse than no code.

## Golden rule — the subsumption principle

> Code a mention to a concept that is **equivalent to it or MORE GENERAL**
> (a broader/parent concept). **Never** code to a concept that is **more specific**
> than what the note states.

Coding more generally loses detail but asserts nothing false. Coding more
specifically invents clinical facts — a site, cause, severity, subtype, or a
larger syndrome — that were never documented. When in doubt, go broader or return
null.

## What to code (and what to skip)

- **Code:** diagnoses, clinical findings, procedures, medications, and (when
  named) body structures and morphologies.
- **Skip:** raw measurements and their numeric values — vital signs (blood
  pressure, pulse/heart rate, temperature, respiratory rate, oxygen saturation)
  and laboratory result values. Do **not** infer a finding from a value.
  Only code a clinician's **named interpretation** (e.g. "hypotension", "fever",
  "bradycardia", "thrombocytopenia").
- **Negation/absence is separate:** always code the **positive** concept and
  record presence in a `context` field. "no fever" → code **Fever**, context
  `absent`. Never reject a candidate because the mention is negated.

## Procedure

For the whole note: first list the mentions to code (skipping measurements as
above), each with a `type` (finding / procedure / medication / body structure)
and a `context` (present / absent / unknown). Then bind each mention with the
generalization ladder below.

### The generalization ladder (retrieval)

Search in order of **increasing generality**, never more specific than the
mention. Accept the **most specific faithful hit** (the lowest rung that returns
a concept equivalent to the mention), then stop.

1. **Rung 0 — same meaning.** Reword the mention to its standard clinical term:
   fix spelling, expand abbreviations, map brand→ingredient and US→international
   names, map lay→clinical. Examples: "low platelet count"→"thrombocytopenia";
   "HTN"→"hypertension"; "Plavix"→"clopidogrel"; "albuterol"→"salbutamol".
   Call `expand` with the type's ECL (below) and this term as `filter`.
2. **Rung 1 — drop one qualifier.** If no faithful hit, remove a single
   qualifier the note does not need for identity — laterality, severity, or a
   site/cause modifier. "bilateral pelvic masses"→"pelvic mass";
   "left frontal headache"→"headache". Search again.
3. **Rung 2+ — progressively general.** Reduce to the head noun or a parent
   category. "pelvic mass"→"mass"; "degenerative joint disease of the spine"→
   "degenerative joint disease". Search again.

At each rung, read the returned candidates and pick the one that is **equivalent
to or more general than the mention** — never one that adds an unstated
qualifier. If several fit, prefer the most specific faithful one.

### Structural generalization (preferred over guessing broader words)

Once rung 0 returns any plausible **seed** concept, you can generalize using
SNOMED's own hierarchy instead of guessing broader phrases:

- Call `expand` with ECL `> <seedConceptId>` (proper ancestors) and, optionally,
  the broader term as `filter`. This returns the seed's ancestors.
- Pick the **most specific ancestor that is still faithful** to the mention.

Use `lookup` on a candidate to read its synonyms/definition when you need to
confirm that a differently-worded concept really is equivalent (e.g. confirm
"Eruption" carries the synonym "Rash").

### Asking for more options

If a rung's candidate list is poor (all more-specific, off-topic, or empty),
**re-query** — try an alternative rung-0 synonym, a broader term, or `> seedId`.
Do this deliberately, not endlessly.

## Accept / reject checklist per candidate

Choose a candidate only if ALL hold:
- It is **equivalent to or more general** than the mention (not more specific).
- It is the **same concept**, not a different one that merely shares words
  ("low platelet count" ≠ "HELLP syndrome"; "recent travel" ≠ "DVT due to recent
  air travel"; "Abdomen: benign" ≠ "Adenoma").
- It is **not the opposite meaning** ("clear breath sounds" ≠ "harsh breath
  sounds").
- It is a disorder/finding when the mention is a finding — **not** a risk/status
  concept ("venous thromboembolism" ≠ "at low risk of venous thromboembolism").

Wording differences do NOT disqualify a candidate: SNOMED's generic concept for a
lay term is often reworded with a "disorder"/"disposition"/"finding" suffix —
"high blood pressure" ≡ "Hypertensive disorder"; "allergy" ⊆ "Allergic
disposition"; "low platelet count" ≡ "Thrombocytopenic disorder";
"shortness of breath" ≡ "Dyspnea". These are faithful — code them.

## Termination and guardrails

- Try at most ~5 searches per mention (rungs + a couple of re-queries).
- Stop at the first faithful hit; accept the most specific faithful concept.
- If no rung yields a faithful concept, return **null** for that mention.
- Keep ECL to the type roots below plus `>`/`<<`; do not build broad ECL that
  could return huge result sets.

## ECL by mention type (for `expand`)

- finding → `<< 404684003 |Clinical finding|`
- procedure → `<< 71388002 |Procedure|`
- medication → `<< 373873005 |Pharmaceutical / biologic product (product)|`
- body structure → `<< 123037004 |Body structure (body structure)|`
- morphology → search as a clinical finding (`<< 404684003`)

## Output

Return one record per mention (JSON):

```json
{
  "mention": "verbatim text from the note",
  "type": "finding | procedure | medication | body structure",
  "context": "present | absent | unknown",
  "code": "SNOMED CT concept id, or null",
  "display": "the concept's preferred term, or null",
  "rungReached": 0,
  "confidence": "high | medium | low",
  "rationale": "one line: why this concept, or why null"
}
```

- `rungReached` records how far down the ladder you went (0 = equivalent match).
- `confidence` derives from the rung: 0 → high; 1 → medium; 2+ or a shaky
  structural ancestor → low. Low-confidence codes should be flagged for human
  review.
- Never fabricate a code or a display — both come from the tool results.

## Drift taxonomy — code these correctly (worked examples)

| Mention | ✅ Code | ✗ Avoid | Why |
|---|---|---|---|
| high blood pressure | Hypertensive disorder | Renal hypertension | reworded generic, not a subtype |
| allergy (denied) | Allergic disposition | Allergy to nut | more general is safe |
| low platelet count | Thrombocytopenic disorder | HELLP syndrome | different, more-specific concept |
| recent travel (denied) | null | DVT due to recent air travel | shares words, wrong concept |
| occupational exposure (denied) | Occupational exposure (or null) | Effects of occupational exposure to radiation | unstated cause |
| Abdomen: benign | null | Adenoma | "benign exam" ≠ a benign tumor |
| clear breath sounds | (finding, if codable) | Harsh breath sounds | opposite meaning |
| green sputum | Gray/Green sputum | No sputum | opposite polarity |
| blood pressure 92/52 | (skip — measurement) | Low blood pressure | do not infer from a value |
| Plavix 75 mg | Clopidogrel (product) | Clopidogrel 300 mg tablet | code the ingredient/product, not a dose form |

This skill is a portable, model-agnostic re-statement of the coding heuristics
validated in the entity-extraction demo; see
[docs/coding-agent-design.md](../../docs/coding-agent-design.md).
