import { Component, Input, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TerminologyService } from '../services/terminology.service';
import { OpenaiService } from '../services/openai.service';
import { TraceCandidate } from './entity-trace.model';
import { EntityTraceDialogComponent } from '../entity-trace-dialog/entity-trace-dialog.component';

@Component({
    selector: 'app-nlp-function',
    templateUrl: './nlp-function.component.html',
    styleUrls: ['./nlp-function.component.css'],
    standalone: false
})
export class NlpFunctionComponent implements OnInit {
  @Input() apiKey: string = "";

  clinicalText = "An 80-year-old woman was admitted with pancytopenia. Five weeks earlier, nausea, vomiting, diarrhea, chills, and no fever had developed. CT revealed bilateral pelvic masses; examination of a peripheral-blood smear revealed schistocytes, anisocytosis, and a low platelet count. ";
  nlpResult = "";
  loadingNlp = false; 
  entities: any[] = [];
  displayedColumns: string[] = ['text', 'type', 'context', 'snomed', 'steps', 'flow'];
  status = "";

  lateralities: any[] = [
    { code: '7771000', display: 'Left'},
    { code: '24028007', display: 'Right'},
    { code: '51440002', display: 'Bilateral'}
  ];

  severities: any[] = [
    { code: '255604002', display: 'Mild'},
    { code: '6736007', display: 'Moderate'},
    { code: '24484000', display: 'Severe'}
  ];

  constructor(private terminologyService: TerminologyService, private openaiService: OpenaiService, public dialog: MatDialog) { }

  ngOnInit(): void {
  }

  /** Open the per-entity flow diagram (works for matched and unmatched). */
  openTrace(entity: any): void {
    this.dialog.open(EntityTraceDialogComponent, {
      data: { entity },
      width: '640px',
      maxWidth: '92vw'
    });
  }

  async runNlp(): Promise<void> {
    const startTime = performance.now();
    try {
    this.status = 'Phase 1/3 · Extracting clinical entities from text…';
    this.loadingNlp = true;
    this.nlpResult = "";
    this.entities = [];
    const systemPrompt = {role: "system", content: `You are a nlp clinical entity extractor. Extract clinical terms from free text clinical notes and report back with SNOMED CT codes. Be thorough: also capture imaging and procedure mentions even when abbreviated (e.g. CT, MRI, X-ray, ultrasound, ECG). The "text" field must be the clinical term copied verbatim from the input note (so it can be highlighted), but WITHOUT surrounding/trailing punctuation (commas, periods, semicolons) and WITHOUT leading articles (a/an/the); never paraphrase or add words there. For each entity also provide its standard clinical term as used in SNOMED CT (clinicalTerm): map lay or descriptive phrasing to formal terminology and correct spelling (e.g. "low platelet count" -> "thrombocytopenia"), and a broader generalTerm dropping specific qualifiers (e.g. "bilateral pelvic masses" -> "mass"). clinicalTerm and generalTerm must always be the POSITIVE concept even when the mention is negated (the negation is recorded in context=absent), e.g. "no fever" -> clinicalTerm "fever". If the note is not in English, keep "text" verbatim in the source language (for highlighting) but give clinicalTerm and generalTerm IN ENGLISH (translate them), and set "language" to the source language, e.g. "fiebre" -> language "Spanish", clinicalTerm "fever".`};
    // Strict JSON schema for Structured Outputs. In strict mode every property
    // must be listed in `required` and objects need additionalProperties:false;
    // optional fields (severity/laterality) are modelled as nullable unions.
    const schema = {
      name: "clinical_entities",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          terms: {
            type: "array",
            description: "List of clinical terms extracted from the text.",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                text: { type: "string", description: "The clinical term copied verbatim from the input note (same words, casing and internal hyphens/spaces, so it can be highlighted), but WITHOUT any surrounding or trailing punctuation (no commas, periods, semicolons, quotes) and WITHOUT leading articles (a/an/the). E.g. from '…, nausea, vomiting.' use 'nausea' and 'vomiting'. Do NOT paraphrase, normalize, add words, parentheses, or annotations here — put normalized/inferred wording in fsn and clinicalTerm instead." },
                type: { type: "string", enum: ["finding", "procedure", "medication", "morphology", "body structure"], description: "The type of clinical term" },
                context: { type: "string", enum: ["present", "absent", "unknown"], description: "Whether the term is present, absent or unknown" },
                fsn: { type: "string", description: "The fully specified name of the term. Spell out acronyms." },
                singularFsn: { type: "string", description: "The fsn, removing plurals" },
                language: { type: "string", description: "The language of the extracted text (English name of the language, e.g. 'English', 'Spanish', 'French')." },
                clinicalTerm: { type: "string", description: "The standard clinical term used in SNOMED CT for this concept, IN ENGLISH — translate from the source language if the text is not English (e.g. 'fiebre' -> 'fever', 'insuffisance cardiaque' -> 'heart failure'). Map lay/descriptive phrasing to formal terminology and correct spelling (e.g. 'low platelet count' -> 'thrombocytopenia'). ALWAYS give the POSITIVE concept even when the text is negated — the negation is captured separately in context (e.g. 'no fever' -> 'fever'). If the text is already a standard positive English clinical term, repeat it unchanged." },
                generalTerm: { type: "string", description: "A broader, more general clinical term for this concept, IN ENGLISH, dropping specific anatomical or other qualifiers so it can still match when the specific phrasing is absent from the terminology (e.g. 'bilateral pelvic masses' -> 'mass', 'left frontal headache' -> 'headache'). Use the clinical/standard wording." },
                severity: { type: ["string", "null"], enum: ["mild", "moderate", "severe", null], description: "The severity contained in the term, or null if none" },
                laterality: { type: ["string", "null"], enum: ["left", "right", "bilateral", null], description: "The laterality contained in the term, or null if none" }
              },
              required: ["text", "type", "context", "language", "fsn", "singularFsn", "clinicalTerm", "generalTerm", "severity", "laterality"]
            }
          }
        },
        required: ["terms"]
      }
    };
    const message = `Extract clinical terms and assign SNOMED CT codes to this text: ${this.clinicalText}\n`;
    const completion = await this.openaiService.extract([systemPrompt, {role: "user", content: message}], schema, { maxCompletionTokens: 10000 });
    this.entities = completion.parsed?.terms ?? [];
    this.entities.forEach((entity: any) => {
      // Defensively trim surrounding punctuation/whitespace the model sometimes
      // includes in the verbatim span (e.g. "nausea," / "pancytopenia.").
      // Internal hyphens/apostrophes/spaces are preserved.
      entity.text = (entity.text || '')
        .replace(/^[\s.,;:!?()"'\[\]{}]+/, '')
        .replace(/[\s.,;:!?()"'\[\]{}]+$/, '')
        .trim();
      // Start the per-entity trace with what the LLM produced (raw type,
      // before we collapse it to a single-letter code).
      const rawType = entity.type;
      entity.matched = false;
      entity.trace = {
        term: entity.text,
        matched: false,
        steps: [{
          stage: 'extract',
          status: 'ok',
          title: 'Extracted by LLM',
          detail: `"${entity.text}" → ${rawType}, ${entity.context}` + (entity.language && entity.language !== 'English' ? ` · ${entity.language}` : ''),
          data: {
            type: rawType,
            context: entity.context,
            language: entity.language,
            fsn: entity.fsn,
            singularFsn: entity.singularFsn,
            severity: entity.severity ?? null,
            laterality: entity.laterality ?? null
          }
        }]
      };

      if (entity.type == "finding") {
        entity.type = "F";
      } else if (entity.type == "procedure") {
        entity.type = "P";
      } else if (entity.type == "medication") {
        entity.type = "M";
      } else if (entity.type == "morphology") {
        entity.type = "Mo";
      } else if (entity.type == "body structure") {
        entity.type = "B";
      }
      if (!entity.fsn?.length) { entity.fsn = entity.text; }
      if (!entity.singularFsn) { entity.singularFsn = entity.fsn; }
    });
    this.status = `Phase 2/3 · Found ${this.entities.length} entities — matching with SNOMED CT…`;
    await this.matchWithSnomed(this.entities);
    // Phase 3: post-process the matched entities.
    this.status = 'Phase 3/3 · Finalizing results…';
    // Keep unmatched entities too: entities the LLM detected but that could not
    // be resolved on the terminology server stay visible (dotted highlight),
    // so it is clear whether a term was missed at extraction or at matching.
    // remove duplicates with same text
    this.entities = this.entities.filter((entity: any, index: number, self: any[]) => self.findIndex((e: any) => e.text === entity.text) === index);
    const matchedCount = this.entities.filter((e: any) => e.matched).length;
    // Per-entity flow traces — inspect in devtools while we build the visual.
    console.log('Entity flow traces:', this.entities.map((e: any) => e.trace));
    this.nlpResult = JSON.stringify(this.entities, null, 2);
    const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
    const costPart = completion.cached ? 'Using AI cache · $0.00' : `Cost: $${completion.cost}`;
    this.status = `Done in ${elapsed}s · ${matchedCount}/${this.entities.length} entities matched to SNOMED CT · ${costPart} · ${this.openaiService.getModel()}`;
    // const functionPrompt = {role: "function", name: functionName, content: JSON.stringify(this.entities)};
    // const completion2 = await this.openaiService.completion(
    //   [
    //     systemPrompt,
    //     {role: "user", content: message},
    //     completion.data.choices[0].message,
    //     functionPrompt], 1000, 0);
    // console.log(completion2);
    } catch (err: any) {
      this.status = 'Error: ' + (err?.message || 'Could not extract entities.');
    } finally {
      this.loadingNlp = false;
    }
  }

  async asyncForEach(array: any[], callback: any) {
    for (let i = 0; i < array.length; i++) {
      await callback(array[i], i, array);
    }
  }
  
  async matchWithSnomed(entities: any[]) {
    let count = 0;
    await this.asyncForEach(entities, async (entity: any) => {
      count++;
      this.status = `Phase 2/3 · Matching with SNOMED CT (${count} of ${entities.length})…`;
      const { ecl, label } = this.terminologyService.eclForType(entity.type);
      const DISTANCE_THRESHOLD = 50;
      const COVERAGE_MIN = 0.5;
      let considered: any = null; // best candidate seen across passes (by rank)
      let lastLookup: any = null; // synonym $lookup done in the last consider(), for the trace

      // Rank candidates by *our* criteria — exact normalized match, then query
      // token coverage, then edit distance — rather than trusting the server's
      // order (Snowstorm Lite mis-ranks broad terms). Escalation is gated on
      // "no accepted match yet", NOT "zero candidates", so lexically unrelated
      // noise (returned but low-coverage) still falls through to the next pass.
      const rankBetter = (a: any, b: any): boolean =>
        !b ? true
          : (!!a.exact !== !!b.exact) ? !!a.exact
          : ((a.coverage ?? 0) !== (b.coverage ?? 0)) ? (a.coverage ?? 0) > (b.coverage ?? 0)
          : a.distance < b.distance;
      const consider = async (cands: TraceCandidate[]): Promise<boolean> => {
        lastLookup = null;
        if (!cands.length) return false;
        const top = [...cands].sort((a, b) => rankBetter(a, b) ? -1 : 1)[0];

        // The server returns the preferred term, but the match may have been on
        // a SYNONYM. If low PT coverage is the only thing holding back an
        // otherwise-close candidate, look up the concept's synonyms and
        // re-score coverage against the best-matching term.
        if (!top.exact && (top.coverage ?? 0) < COVERAGE_MIN && top.distance < DISTANCE_THRESHOLD) {
          const terms = await this.terminologyService.conceptTerms(top.code).toPromise();
          const qTokens = this.tokenize(queryTerm);
          for (const t of terms || []) {
            const cov = this.tokenCoverage(qTokens, t);
            if (cov > (top.coverage ?? 0)) {
              top.coverage = cov;
              top.matchedTerm = t;
            }
          }
          // Don't flag a "synonym" when the winning term is just the PT itself.
          if (top.matchedTerm && this.normText(top.matchedTerm) === this.normText(top.display)) {
            top.matchedTerm = undefined;
          }
          lastLookup = {
            code: top.code,
            terms: (terms || []).length,
            coverage: top.coverage,
            matchedTerm: top.matchedTerm
          };
        }

        if (rankBetter(top, considered)) {
          considered = top;
        }
        // Confidence guardrail: accept only an exact match, or one with enough
        // query-token coverage AND a sane edit distance.
        const confident = !!top.exact || ((top.coverage ?? 0) >= COVERAGE_MIN && top.distance < DISTANCE_THRESHOLD);
        if (!entity.snomed && confident) {
          entity.snomed = { code: top.code, display: top.display };
          top.chosen = true;
          return true;
        }
        return false;
      };
      const searchStatus = (cands: TraceCandidate[], accepted: boolean) =>
        accepted ? 'ok' : (cands.length ? 'warn' : 'fail');
      // If the previous consider() ran a synonym $lookup, surface it as its own
      // (Snowstorm) step right after the search that triggered it.
      const pushLookupStep = () => {
        if (!lastLookup) return;
        entity.trace.steps.push({
          stage: 'lookup',
          status: 'ok',
          title: 'Synonym lookup',
          detail: `$lookup ${lastLookup.code} · ${lastLookup.terms} term(s) · best coverage ${Math.round((lastLookup.coverage ?? 0) * 100)}%`
            + (lastLookup.matchedTerm ? ` (via "${lastLookup.matchedTerm}")` : ''),
          data: { code: lastLookup.code, terms: lastLookup.terms, coverage: lastLookup.coverage, matchedTerm: lastLookup.matchedTerm }
        });
        lastLookup = null;
      };

      // Pass 1 — LITERAL search. When the mention is negated (context=absent)
      // we search the POSITIVE term with the negation stripped ("no fever" ->
      // "fever"); the negation is preserved via context and encoded in the CTUF
      // below (Known absent). The demo only needs to find the positive code.
      const negated = entity.context === 'absent';
      const baseTerm = negated ? this.stripNegation(entity.text) : entity.text;
      let queryTerm = baseTerm;
      let candidates = await this.searchCandidates(queryTerm, entity.type);
      let accepted = await consider(candidates);
      entity.trace.steps.push({
        stage: 'search',
        status: searchStatus(candidates, accepted),
        title: 'Literal search',
        detail: `${label} · literal "${queryTerm}"${baseTerm !== entity.text ? ` (negation stripped from "${entity.text}")` : ''} → ${candidates.length} candidate(s)`,
        data: { ecl, queryTerm, candidates }
      });
      pushLookupStep();

      // Pass 2 — NORMALIZE by *removing* modifiers (laterality/severity) and
      // parenthetical qualifiers/semantic tags, then search. Skipped when
      // there is nothing to strip.
      if (!entity.snomed) {
        const normalized = this.normalizeTerm(baseTerm);
        const changed = normalized !== baseTerm;
        entity.trace.steps.push({
          stage: 'normalize',
          status: changed ? 'ok' : 'warn',
          title: changed ? 'Normalized (stripped modifiers)' : 'Nothing to strip',
          detail: changed ? `"${baseTerm}" → "${normalized}"` : `no modifiers to remove from "${baseTerm}"`,
          data: { from: baseTerm, to: normalized }
        });
        if (changed) {
          queryTerm = normalized;
          candidates = await this.searchCandidates(queryTerm, entity.type);
          accepted = await consider(candidates);
          entity.trace.steps.push({
            stage: 'search',
            status: searchStatus(candidates, accepted),
            title: 'Normalized search',
            detail: `${label} · "${queryTerm}" → ${candidates.length} candidate(s)`,
            data: { ecl, queryTerm, candidates }
          });
          pushLookupStep();
        }
      }

      // Pass 3 — CLINICAL TERM from the extraction: the standard SNOMED-style
      // term the LLM already produced (e.g. "low platelet count" →
      // "thrombocytopenia", correcting spelling too). This is a *semantic*
      // reformulation, tried before the purely lexical fuzzy fallback. No extra
      // LLM call — it came for free with the initial extraction.
      if (!entity.snomed) {
        const clinical = (entity.clinicalTerm || '').trim();
        const usable = !!clinical
          && clinical.toLowerCase() !== queryTerm.toLowerCase()
          && clinical.toLowerCase() !== entity.text.toLowerCase();
        const translated = entity.language && entity.language !== 'English';
        entity.trace.steps.push({
          stage: 'synonym',
          status: clinical ? 'ok' : 'warn',
          title: translated ? `Clinical term (translated from ${entity.language})` : 'Clinical term (from extraction)',
          detail: clinical ? `"${entity.text}" → "${clinical}"` : `no clinical term provided`,
          data: { from: entity.text, to: clinical, language: entity.language }
        });
        if (usable) {
          queryTerm = clinical;
          candidates = await this.searchCandidates(queryTerm, entity.type);
          accepted = await consider(candidates);
          entity.trace.steps.push({
            stage: 'search',
            status: searchStatus(candidates, accepted),
            title: 'Clinical term search',
            detail: `${label} · "${queryTerm}" → ${candidates.length} candidate(s)`,
            data: { ecl, queryTerm, candidates }
          });
          pushLookupStep();
        }
      }

      // Pass 4 — GENERAL TERM from the extraction: a broader form the LLM
      // produced (e.g. "bilateral pelvic masses" → "mass"), for when the
      // specific phrasing is absent from the terminology. Also free (from the
      // initial extraction), so no extra LLM round-trip.
      if (!entity.snomed) {
        const general = (entity.generalTerm || '').trim();
        const usable = !!general
          && general.toLowerCase() !== queryTerm.toLowerCase()
          && general.toLowerCase() !== entity.text.toLowerCase();
        entity.trace.steps.push({
          stage: 'synonym',
          status: general ? 'ok' : 'warn',
          title: 'General term (from extraction)',
          detail: general ? `"${entity.text}" → "${general}"` : `no general term provided`,
          data: { from: entity.text, to: general }
        });
        if (usable) {
          queryTerm = general;
          candidates = await this.searchCandidates(queryTerm, entity.type);
          accepted = await consider(candidates);
          entity.trace.steps.push({
            stage: 'search',
            status: searchStatus(candidates, accepted),
            title: 'General term search',
            detail: `${label} · "${queryTerm}" → ${candidates.length} candidate(s)`,
            data: { ecl, queryTerm, candidates }
          });
          pushLookupStep();
        }
      }

      // Pass 5 — FUZZY search (Snowstorm `~`): last resort for typos / spelling
      // variants, using the most reduced term we have.
      if (!entity.snomed) {
        candidates = await this.searchCandidates(queryTerm, entity.type, true);
        accepted = await consider(candidates);
        entity.trace.steps.push({
          stage: 'search',
          status: searchStatus(candidates, accepted),
          title: 'Fuzzy search',
          detail: `${label} · fuzzy "${queryTerm}~" → ${candidates.length} candidate(s)`,
          data: { ecl, queryTerm: `${queryTerm}~`, candidates }
        });
        pushLookupStep();
      }

      entity.trace.steps.push({
        stage: 'score',
        status: entity.snomed ? 'ok' : (considered ? 'warn' : 'fail'),
        title: entity.snomed ? 'Candidate accepted' : (considered ? 'Candidate rejected' : 'No candidate to score'),
        detail: considered
          ? `closest "${considered.display}" · distance ${considered.distance}, coverage ${Math.round((considered.coverage ?? 0) * 100)}% (accept if exact, or ≥${Math.round(COVERAGE_MIN * 100)}% coverage & distance < ${DISTANCE_THRESHOLD})`
          : `nothing returned by the server for this term/hierarchy`,
        data: { distance: considered?.distance ?? null, coverage: considered?.coverage ?? null, threshold: DISTANCE_THRESHOLD, coverageMin: COVERAGE_MIN }
      });
      if (entity.snomed) {
        entity.matched = true;
        let ctuf = entity.snomed.code + " |" + entity.snomed.display + "|:\n";
        if (entity.type == "F" && entity.context == "absent") {
         ctuf = ctuf + `408729009 |Finding context| = 410516002 |Known absent|`;
        }
        if (entity.laterality) {
          let laterality = this.lateralities.find((l: any) => l.display.toLowerCase() == entity.laterality.toLowerCase());
          if (laterality) {
            if (!ctuf.endsWith(":\n")) {
              ctuf = ctuf + " ,\n";
            }
            ctuf = ctuf + `272741003 |Laterality| = ${laterality.code} |${laterality.display}|`;
          }
        }
        if (entity.severity) {
          let severity = this.severities.find((s: any) => s.display.toLowerCase() == entity.severity.toLowerCase());
          if (severity) {
            if (!ctuf.endsWith(":\n")) {
              ctuf = ctuf + " ,\n";
            }
            ctuf = ctuf + `246112005 |Severity| = ${severity.code} |${severity.display}|`;
          }
        }
        if (ctuf.endsWith(":\n")) {
          // remove last 2 characters of the form
          ctuf = ctuf.substring(0, ctuf.length - 2);
        }
        entity.snomed.expression = ctuf;
      } else {
        // Detected by the LLM but not resolved on the terminology server.
        entity.matched = false;
        if (!considered) {
          entity.snomed = { expression: 'No match found (server returned no candidates)' };
        } else {
          entity.snomed = { expression: `No match found (closest: "${considered.display}", distance ${considered.distance}, coverage ${Math.round((considered.coverage ?? 0) * 100)}%)` };
        }
      }

      entity.trace.matched = entity.matched;
      entity.trace.steps.push({
        stage: 'result',
        status: entity.matched ? 'ok' : 'fail',
        title: entity.matched ? 'Matched to SNOMED CT' : 'Unresolved',
        detail: entity.matched
          ? `${entity.snomed.code} | ${entity.snomed.display}`
          : entity.snomed.expression,
        data: entity.matched
          ? { code: entity.snomed.code, display: entity.snomed.display }
          : { reason: entity.snomed.expression }
      });
    });
  }

  /**
   * Query Snowstorm for a term and score every candidate for the trace.
   * With `fuzzy`, appends Snowstorm's `~` operator to tolerate typos/variants.
   */
  private async searchCandidates(term: string, type: string, fuzzy: boolean = false): Promise<TraceCandidate[]> {
    const filter = fuzzy ? `${term}~` : term;
    const response = await this.terminologyService.matchText(filter, type).toPromise();
    const queryTokens = this.tokenize(term);
    const queryNorm = this.normText(term);
    return (response?.expansion?.contains || []).map((c: any) => {
      const clean = this.removeSemtag(c.display);
      return {
        code: c.code,
        display: c.display,
        // Distance/coverage are measured against the clean term (no fuzzy '~'),
        // case-insensitive so casing differences don't inflate them.
        distance: this.levenshteinDistance(term.toLowerCase(), clean.toLowerCase()),
        coverage: this.tokenCoverage(queryTokens, clean),
        exact: this.normText(clean) === queryNorm
      };
    });
  }

  /** Normalize for token comparison: drop semtag, lowercase, keep alphanumerics. */
  private normText(s: string): string {
    return this.removeSemtag(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  /** Content tokens: normalized, stopwords removed, lightly stemmed. */
  private tokenize(s: string): string[] {
    const stop = new Set(['of', 'the', 'a', 'an', 'and', 'with', 'to', 'in', 'on', 'for', 'by', 'or']);
    return this.normText(s).split(' ')
      .filter(t => t && !stop.has(t))
      .map(t => t.length > 4 ? t.replace(/(es|s)$/, '') : t);
  }

  /** Fraction of the query's content tokens present in the candidate display. */
  private tokenCoverage(queryTokens: string[], display: string): number {
    if (!queryTokens.length) return 0;
    const set = new Set(this.tokenize(display));
    const matched = queryTokens.filter(t => set.has(t)).length;
    return matched / queryTokens.length;
  }

  /**
   * Remove negation cues so a negated mention is searched as its positive
   * concept (e.g. "no fever" -> "fever", "denies chest pain" -> "chest pain").
   * The fact that it was negated is carried separately in the entity context.
   * Longer phrases are listed first so they match before the bare "no"/"not".
   */
  private stripNegation(text: string): string {
    const t = (text || '')
      .replace(/\b(no evidence of|no history of|no signs of|negative for|absence of|without|denies|denied|ruled out|free of|absent|no|not)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return t || text;
  }

  /**
   * Reduce a term for the fallback search: drop parenthetical qualifiers /
   * semantic tags and laterality/severity modifiers. Always *removes*, never
   * adds — the goal is a simpler, more matchable string than the literal.
   */
  private normalizeTerm(text: string): string {
    let t = (text || '').replace(/\([^)]*\)/g, ' ');                        // parentheticals & semtags
    t = t.replace(/\b(left|right|bilateral|mild|moderate|severe)\b/gi, ' '); // laterality / severity
    t = t.replace(/\s+/g, ' ').trim();
    return t || text;
  }

  removeSemtag(text: string): string {
    let index = text.lastIndexOf("(");
    if (index > 0) {
      return text.substring(0, index).trim();
    }
    return text;
  }

  levenshteinDistance(s: string, t: string): number {
    const m = s.length;
    const n = t.length;
  
    // If one of the strings is empty, the distance is the length of the other string
    if (m === 0) return n;
    if (n === 0) return m;
  
    // Create a matrix of distances
    const d: number[][] = [];
    for (let i = 0; i <= m; i++) {
      d[i] = [i];
    }
    for (let j = 0; j <= n; j++) {
      d[0][j] = j;
    }
  
    // Calculate the distance
    for (let j = 1; j <= n; j++) {
      for (let i = 1; i <= m; i++) {
        if (s.charAt(i - 1) === t.charAt(j - 1)) {
          d[i][j] = d[i - 1][j - 1];
        } else {
          const substitutionCost = d[i - 1][j - 1] + 1;
          const insertionCost = d[i][j - 1] + 1;
          const deletionCost = d[i - 1][j] + 1;
          d[i][j] = Math.min(substitutionCost, insertionCost, deletionCost);
        }
      }
    }
  
    // Return the Levenshtein distance
    return d[m][n];
  }
  

  
}