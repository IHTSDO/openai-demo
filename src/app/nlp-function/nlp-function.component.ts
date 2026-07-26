import { Component, Input, OnInit, ViewChild, ElementRef, NgZone } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TerminologyService } from '../services/terminology.service';
import { OpenaiService } from '../services/openai.service';
import { TraceCandidate } from './entity-trace.model';
import { EntityTraceDialogComponent } from '../entity-trace-dialog/entity-trace-dialog.component';
import { AlgorithmTuningDialogComponent } from '../algorithm-tuning-dialog/algorithm-tuning-dialog.component';
import { TuningService } from '../services/tuning.service';
import { CodingAgentService } from '../services/coding-agent.service';

@Component({
    selector: 'app-nlp-function',
    templateUrl: './nlp-function.component.html',
    styleUrls: ['./nlp-function.component.css'],
    standalone: false
})
export class NlpFunctionComponent implements OnInit {
  /** Absence/negation words that flip a concept's polarity when the query lacks them. */
  private static readonly NEG_WORDS = new Set([
    'no', 'not', 'without', 'absent', 'absence', 'negative', 'denies', 'none', 'unremarkable'
  ]);

  @Input() apiKey: string = "";

  @ViewChild('mermaidHost') mermaidHost?: ElementRef<HTMLElement>;
  private diagramRendered = false;
  // "How it works" flow: LLM (purple) and Snowstorm (teal) steps alternating,
  // with a feedback edge back to the LLM when there's no confident match.
  private readonly hiwGraph = `flowchart LR
  N["Clinical note"] --> L["LLM<br/>extract dx / findings /<br/>procedures / meds"]
  L --> S1["Snowstorm<br/>search SNOMED CT"]
  S1 --> S2["Snowstorm<br/>confirm synonyms"]
  S2 --> A["Local<br/>rank and score"]
  A -. "no confident match:<br/>broader / synonym" .-> L
  A --> R["LLM review<br/>uncertain matches"]
  R --> C["SNOMED CT concept"]
  R -. "no faithful<br/>concept" .-> U["Unresolved"]
  classDef llm fill:#ede7f6,stroke:#b39ddb,color:#5e35b1;
  classDef snow fill:#e0f2f1,stroke:#80cbc4,color:#00796b;
  classDef local fill:#eceff1,stroke:#b0bec5,color:#546e7a;
  classDef neutral fill:#ffffff,stroke:#cfd8e3,color:#003865;
  class L,R llm;
  class S1,S2 snow;
  class A local;
  class N,C,U neutral;`;

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

  constructor(private terminologyService: TerminologyService, private openaiService: OpenaiService, public dialog: MatDialog, public tuning: TuningService, private codingAgent: CodingAgentService, private zone: NgZone) { }

  ngOnInit(): void {
  }

  /** Open the algorithm-tuning dialog (edits the shared TuningService). */
  openTuning(): void {
    this.dialog.open(AlgorithmTuningDialogComponent, { width: '460px', maxWidth: '92vw' });
  }

  /** Editing the note invalidates the previous run: hide results and status. */
  onClinicalTextChange(): void {
    this.nlpResult = '';
    this.entities = [];
    this.status = '';
  }

  /** Render the "How it works" Mermaid diagram the first time it's opened.
   * Mermaid is imported dynamically so it stays out of the main bundle. */
  async renderDiagram(ev: Event): Promise<void> {
    const details = ev.target as HTMLDetailsElement;
    if (!details?.open || this.diagramRendered || !this.mermaidHost) {
      return;
    }
    this.diagramRendered = true;
    try {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict', flowchart: { useMaxWidth: true, htmlLabels: true } });
      const { svg } = await mermaid.render('hiwGraph', this.hiwGraph);
      this.mermaidHost.nativeElement.innerHTML = svg;
    } catch {
      this.diagramRendered = false; // allow a retry on next open
    }
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
    const systemPrompt = {role: "system", content: `You are a nlp clinical entity extractor. Extract clinical terms from free text clinical notes and report back with SNOMED CT codes. Be thorough: also capture imaging and procedure mentions even when abbreviated (e.g. CT, MRI, X-ray, ultrasound, ECG). Extract ONLY diagnoses, clinical findings, procedures, and medications. Do NOT extract raw measurements or their numeric values — vital signs (blood pressure, pulse/heart rate, temperature, respiratory rate, oxygen saturation) and laboratory test results/values are OUT OF SCOPE, and do not infer a finding from a raw value (e.g. skip "blood pressure 92/52", "pulse 55", "temperature 98", "platelets 43", "O2 sat 95%"). Only when the clinician explicitly names a clinical interpretation as a finding/diagnosis (e.g. "hypotension", "fever", "bradycardia", "hypoxia", "thrombocytopenia") do you extract that finding. The "text" field must be the clinical term copied verbatim from the input note (so it can be highlighted), but WITHOUT surrounding/trailing punctuation (commas, periods, semicolons) and WITHOUT leading articles (a/an/the); never paraphrase or add words there. For each entity also provide its standard clinical term as used in SNOMED CT (clinicalTerm): map lay or descriptive phrasing to formal terminology and correct spelling (e.g. "low platelet count" -> "thrombocytopenia"), and a broader generalTerm dropping specific qualifiers (e.g. "bilateral pelvic masses" -> "mass"). clinicalTerm and generalTerm must always be the POSITIVE concept even when the mention is negated (the negation is recorded in context=absent), e.g. "no fever" -> clinicalTerm "fever". If the note is not in English, keep "text" verbatim in the source language (for highlighting) but give clinicalTerm and generalTerm IN ENGLISH (translate them), and set "language" to the source language, e.g. "fiebre" -> language "Spanish", clinicalTerm "fever".`};
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
    // Large notes (many entities) plus the model's reasoning tokens can exceed a
    // small budget and truncate the JSON; give the extraction generous room.
    const completion = await this.openaiService.extract([systemPrompt, {role: "user", content: message}], schema, { maxCompletionTokens: 20000 });
    // Clone the extracted terms so each run starts from fresh entity objects.
    // Matching mutates entities (text/type/snomed/trace); without cloning, a
    // re-run would reuse the cached extraction's already-matched objects and
    // skip the cascade — ignoring any tuning change — and pollute the LLM cache.
    this.entities = structuredClone(completion.parsed?.terms ?? []);
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
      // Strip parenthetical alternatives/brands the model sometimes adds to the
      // search terms (e.g. "albuterol (salbutamol) inhaler"), which break the
      // terminology filter. Keep the terms as single clean phrases.
      if (entity.clinicalTerm) { entity.clinicalTerm = this.stripParens(entity.clinicalTerm); }
      if (entity.generalTerm) { entity.generalTerm = this.stripParens(entity.generalTerm); }
    });
    this.status = `Phase 2/3 · Found ${this.entities.length} entities — matching with SNOMED CT…`;
    await this.matchWithSnomed(this.entities);
    // Phase 3: optional LLM re-rank — one batched call that lets the model pick
    // the best candidate per entity, or reject them all (null), so an
    // over-specific / off-topic / opposite-polarity candidate is not forced.
    let rerankCost = '';
    if (this.tuning.enableLlmRerank) {
      this.status = 'Phase 3/3 · Reviewing candidates with the LLM…';
      rerankCost = await this.reRankWithLlm(this.entities);
    }
    // Phase 3b: agentic fallback (opt-in) — for entities the deterministic
    // pipeline + review still left unresolved, let a tool-using agent drive the
    // search itself (reword, broaden, walk ECL ancestors). Intense LLM use, so
    // it only runs on the hard leftovers.
    let agentCost = '';
    if (this.tuning.enableCodingAgent) {
      agentCost = await this.runCodingAgent(this.entities);
    }
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
    this.status = `Done in ${elapsed}s · ${matchedCount}/${this.entities.length} entities matched to SNOMED CT · ${costPart}${rerankCost}${agentCost} · ${this.openaiService.getModel()}`;
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
      // The LLM SDK's async can resolve outside Angular's zone, so the final
      // state change (and the results/status set above) may not trigger change
      // detection on its own. Run the reset inside the zone to force a repaint,
      // otherwise the UI stays frozen on the last agent status with the Process
      // button disabled even though the run has finished.
      this.zone.run(() => { this.loadingNlp = false; });
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
      const DISTANCE_THRESHOLD = this.tuning.distanceMax;
      const COVERAGE_MIN = this.tuning.coverageMin;
      let considered: any = null; // best candidate seen across passes (by rank)
      let exactFound = false;     // stop escalating the reformulation passes once we hit an exact match
      let lastLookup: any = null; // synonym $lookup done in the last consider(), for the trace

      // WITHIN a single search we trust the server's relevance order (full
      // Snowstorm ranks the correct generic first, e.g. "hypertension" ->
      // "Hypertensive disorder"). Our own token coverage used to override that
      // and pick a token-containing subtype ("Renal hypertension"); now rank is
      // the primary signal, after only exact-match and the polarity guard.
      const rankWithin = (a: any, b: any): boolean =>
        (!!a.exact !== !!b.exact) ? !!a.exact
          : (!!a.polarityBad !== !!b.polarityBad) ? !a.polarityBad
          : ((a.rank ?? 0) !== (b.rank ?? 0)) ? (a.rank ?? 0) < (b.rank ?? 0)
          : a.distance < b.distance;
      // A candidate is "confident" enough to accept when it is an exact match,
      // or covers the query well (morphology-aware) at a sane edit distance and
      // does not flip polarity. Synonym $lookup can lift coverage first.
      const confident = (c: any): boolean =>
        !!c && (!!c.exact || (!c.polarityBad && (c.coverage ?? 0) >= COVERAGE_MIN && c.distance < DISTANCE_THRESHOLD));
      // ACROSS passes we cannot compare raw ranks (each search ranks against a
      // different query), so prefer exact, then confident, then higher coverage,
      // then shorter distance.
      const betterAcross = (a: any, b: any): boolean =>
        !b ? true
          : (!!a.exact !== !!b.exact) ? !!a.exact
          : (confident(a) !== confident(b)) ? confident(a)
          : ((a.coverage ?? 0) !== (b.coverage ?? 0)) ? (a.coverage ?? 0) > (b.coverage ?? 0)
          : a.distance < b.distance;
      const consider = async (cands: TraceCandidate[]): Promise<boolean> => {
        lastLookup = null;
        if (!cands.length) return false;
        const sorted = [...cands].sort((a, b) => rankWithin(a, b) ? -1 : 1);
        let top = sorted[0];

        // The server returns the preferred term, but the match may have been on
        // a SYNONYM. If low PT coverage is the only thing holding back an
        // otherwise-close candidate, look up the concept's synonyms and
        // re-score coverage against the best-matching term.
        if (this.tuning.enableSynonymLookup && !top.exact && (top.coverage ?? 0) < COVERAGE_MIN && top.distance < DISTANCE_THRESHOLD) {
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

        // If the server's top choice is not confident even after the synonym
        // lookup, fall back to the best-ranked candidate that is confident on
        // its own — a weak rank-0 shouldn't bury a solid lower-ranked hit (e.g.
        // "thrombocytopenia" ranks "Platelet count below reference range" (no
        // coverage) above the clean "Thrombocytopenic disorder").
        if (!confident(top)) {
          const conf = sorted.find(c => confident(c));
          if (conf) { top = conf; }
        }

        if (betterAcross(top, considered)) {
          considered = top;
        }
        if (top.exact) { exactFound = true; }
        // Whether THIS pass produced a confident candidate (only for step status).
        return confident(top);
      };
      const searchStatus = (cands: TraceCandidate[], accepted: boolean) =>
        accepted ? 'ok' : (cands.length ? 'warn' : 'fail');
      // Accept the best candidate seen so far if it clears the guardrail
      // (exact, or enough coverage + sane distance). Deferred so a mediocre
      // literal hit can't pre-empt an exact clinical-term match found later.
      const tryAccept = () => {
        if (entity.snomed || !considered) { return; }
        if (confident(considered)) {
          entity.snomed = { code: considered.code, display: considered.display };
          considered.chosen = true;
        }
      };
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
      if (!exactFound) {
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
      if (!exactFound) {
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

      // Accept the best specific match (literal / normalized / clinical term)
      // BEFORE trying broader fallbacks, so a generic term can't override a
      // good specific concept.
      tryAccept();

      // Guardrail for the BROAD fallback passes: a broadened query ("inflammation",
      // "diagnostic test") can pull in a high-coverage but unrelated concept
      // ("Anal inflammation" for a throat exam). Only let a broad-pass candidate
      // through if it still shares a content token with the specific clinical
      // intent, so the fallback can widen recall without wandering off-topic.
      const anchorTokens = this.tokenize(entity.clinicalTerm || entity.text);
      // Two tokens are "related" if they share a >=4-char stem prefix, so
      // morphological variants count (respiration/respiratory,
      // radiography/radiographic) but unrelated words (anal/pharyngeal) don't.
      const sharesStem = (a: string, b: string): boolean => {
        const n = Math.min(a.length, b.length);
        return n >= 4 && a.slice(0, 4) === b.slice(0, 4);
      };
      const related = (cands: TraceCandidate[]): TraceCandidate[] =>
        !anchorTokens.length ? cands
          : cands.filter(c => {
              const dt = this.tokenize(this.removeSemtag(c.display));
              return c.exact || anchorTokens.some(a => dt.some(d => sharesStem(a, d)));
            });

      // Pass 4 — GENERAL TERM from the extraction: a broader form the LLM
      // produced (e.g. "bilateral pelvic masses" → "mass"), for when the
      // specific phrasing is absent from the terminology. Only a fallback when
      // nothing specific was accepted. Free (from the initial extraction).
      if (!entity.snomed && this.tuning.enableGeneralTerm) {
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
          candidates = related(await this.searchCandidates(queryTerm, entity.type));
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

      // Accept the best of the reformulation passes before the lexical fallbacks.
      tryAccept();

      // Pass 5 — FUZZY search (Snowstorm `~`): last resort for typos / spelling
      // variants, using the most reduced term we have.
      if (!entity.snomed && this.tuning.enableFuzzy && this.terminologyService.supportsFuzzy) {
        candidates = related(await this.searchCandidates(queryTerm, entity.type, true));
        accepted = await consider(candidates);
        entity.trace.steps.push({
          stage: 'search',
          status: searchStatus(candidates, accepted),
          title: 'Fuzzy search',
          detail: `${label} · fuzzy "${queryTerm}~" → ${candidates.length} candidate(s)`,
          data: { ecl, queryTerm: `${queryTerm}~`, candidates }
        });
        pushLookupStep();
        tryAccept();
      }

      // Pass 6 — PREFIX search (opt-in, off by default): last resort using the
      // first 3 letters of each word as the server filter, still scored against
      // the real term. Broadens recall for stubborn cases.
      if (!entity.snomed && this.tuning.enablePrefixSearch) {
        const prefix = this.prefixTerm(queryTerm);
        if (prefix && prefix !== queryTerm.toLowerCase()) {
          candidates = related(await this.searchCandidates(queryTerm, entity.type, false, prefix));
          accepted = await consider(candidates);
          entity.trace.steps.push({
            stage: 'search',
            status: searchStatus(candidates, accepted),
            title: 'Prefix search',
            detail: `${label} · prefix "${prefix}" (for "${queryTerm}") → ${candidates.length} candidate(s)`,
            data: { ecl, queryTerm: prefix, candidates }
          });
          pushLookupStep();
          tryAccept();
        }
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
   * Phase 3 — LLM re-rank. The deterministic cascade proposes a concept per
   * entity, but it is forced to pick from whatever the server returned. Here a
   * single batched LLM call reviews the candidate list for every entity and
   * either picks the faithful concept OR returns null ("none of these"), so an
   * over-specific, off-topic or opposite-polarity candidate is rejected to a
   * clean unmatched rather than accepted. The LLM can only choose among the
   * candidates we retrieved — it cannot fix a recall miss.
   * Returns a status fragment describing the extra cost (or '').
   */
  private async reRankWithLlm(entities: any[]): Promise<string> {
    // Build a compact candidate pool per entity from the trace's search steps
    // (all passes, deduped by code, best-scored first).
    const rank = (a: TraceCandidate, b: TraceCandidate): number =>
      (+!!b.exact) - (+!!a.exact)
      || (+!!a.polarityBad) - (+!!b.polarityBad)
      || (b.coverage ?? 0) - (a.coverage ?? 0)
      || (a.extra ?? 0) - (b.extra ?? 0)
      || (a.distance ?? 0) - (b.distance ?? 0);

    // Confidence gate: only send SUSPICIOUS matches to the LLM. A deterministic
    // match is trusted (skipped) when its chosen concept is exact or adds few
    // extra qualifier tokens; it is reviewed only when the chosen concept piles
    // on unstated qualifiers (high `extra`) — the over-specific / off-topic
    // class (e.g. "recent travel" → "DVT due to air travel", extra 7). This
    // preserves clean generics (hypertension → "Hypertensive disorder", extra 1)
    // without exposing them to the LLM's occasional over-abstention.
    const EXTRA_REVIEW_THRESHOLD = 3;
    let skipped = 0;
    const jobs: { entity: any; candidates: TraceCandidate[] }[] = [];
    for (const entity of entities) {
      const pool = new Map<string, TraceCandidate>();
      for (const step of (entity.trace?.steps ?? [])) {
        for (const c of (step.data?.candidates ?? [])) {
          if (!c?.code) { continue; }
          const cur = pool.get(c.code);
          if (!cur || rank(c, cur) < 0) { pool.set(c.code, c); }
        }
      }
      const candidates = [...pool.values()].sort(rank).slice(0, 8);
      if (!candidates.length) { continue; }
      const chosen = entity.matched && entity.snomed?.code ? pool.get(entity.snomed.code) : null;
      const suspicious = !!chosen && !chosen.exact && (chosen.extra ?? 0) >= EXTRA_REVIEW_THRESHOLD;
      if (suspicious) { jobs.push({ entity, candidates }); } else { skipped++; }
    }
    if (!jobs.length) { return ''; }

    const systemPrompt = {
      role: 'system',
      content: `You are a clinical coder assigning SNOMED CT codes to findings extracted from a note. These codes are not shown to a reader — they feed downstream systems: population analytics and quality measures, cohort selection, and clinical decision support (CDS) rules that trigger on coded findings. Keep that use in mind, because two OPPOSITE mistakes both damage those systems:
• A needless null makes the finding INVISIBLE — the patient's hypertension, allergy, or weight gain vanishes from every query, quality measure, and CDS rule. Reserve null for when every candidate would be MISLEADING.
• A code MORE SPECIFIC than the note states injects FALSE detail — analytics and CDS would treat the patient as having a subtype, cause, site, or syndrome that was never documented.

So the safe and useful choice is a code that is EQUIVALENT to the mention or slightly MORE GENERAL: it keeps the finding visible and asserts nothing false. Coding more generally loses detail but is correct; coding more specifically is wrong.

You are given, per mention, the candidate concepts a search returned and "proposedCode" (the concept our system selected, or null). "chosenCode" MUST be one of the candidate codes, or null — you are picking from the candidates provided, NOT naming an ideal concept.

Decision procedure:
1. Is proposedCode's concept EQUIVALENT to or MORE GENERAL than the mention? Clinical rewordings count as equivalent — "high blood pressure" ≡ "Hypertensive disorder"; "allergy" ⊆ the broader "Allergic disposition"; "low platelet count" ≡ "Thrombocytopenic disorder"; "shortness of breath" ≡ "Dyspnea". If yes → chosenCode = proposedCode. Do NOT return null because a better-named concept is missing from the candidate list — the broader concept present IS the right code.
2. Otherwise, if another candidate is equivalent-or-more-general (prefer equivalent over broader), return its code.
3. Return null ONLY when EVERY candidate is MORE SPECIFIC than the mention (adds an unstated site/cause/severity/subtype/risk-status — "recent travel" vs "deep vein thrombosis due to recent air travel"; "occupational exposure" vs "effects of occupational exposure to radiation"; "low platelet count" vs "HELLP syndrome"; "venous thromboembolism" vs "at low risk of venous thromboembolism"), denotes a DIFFERENT concept, or is the OPPOSITE meaning ("clear breath sounds" vs "harsh breath sounds").

Ignore polarity/negation: "context" records absence separately, so always keep the POSITIVE concept ("no fever" → "Fever"). Give a one-line rationale for each decision.`
    };
    const payload = jobs.map((j, i) => ({
      index: i,
      mention: j.entity.text,
      context: j.entity.context,
      suggestedTerm: j.entity.clinicalTerm,
      proposedCode: j.entity.matched ? (j.entity.snomed?.code ?? null) : null,
      candidates: j.candidates.map(c => ({ code: c.code, term: c.display }))
    }));
    const schema = {
      name: 'concept_selection',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          decisions: {
            type: 'array',
            description: 'One decision per input index.',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                index: { type: 'integer', description: 'The index of the mention being decided.' },
                chosenCode: { type: ['string', 'null'], description: 'The code of the chosen candidate, or null if none is a faithful match.' },
                rationale: { type: 'string', description: 'One-line justification for the choice or for rejecting all candidates.' }
              },
              required: ['index', 'chosenCode', 'rationale']
            }
          }
        },
        required: ['decisions']
      }
    };

    let result: any;
    try {
      result = await this.openaiService.extract(
        [systemPrompt, { role: 'user', content: JSON.stringify(payload) }],
        schema,
        { maxCompletionTokens: 6000 }
      );
    } catch (err: any) {
      // Non-fatal: keep the deterministic results if the review call fails.
      console.warn('LLM re-rank failed, keeping deterministic matches:', err?.message);
      return '';
    }

    for (const d of (result.parsed?.decisions ?? [])) {
      const job = jobs[d.index];
      if (!job) { continue; }
      const entity = job.entity;
      const chosen = d.chosenCode ? job.candidates.find(c => c.code === d.chosenCode) : null;
      const before = entity.matched ? entity.snomed?.display : '∅';
      if (chosen) {
        entity.snomed = { code: chosen.code, display: chosen.display };
        entity.matched = true;
        chosen.chosen = true;
      } else {
        entity.snomed = { expression: 'No faithful candidate (LLM review)' };
        entity.matched = false;
      }
      const after = entity.matched ? entity.snomed.display : '∅';
      const changed = before !== after;
      // Insert the review step just before the final 'result' step and refresh
      // that result step to reflect the LLM's decision.
      const steps = entity.trace?.steps ?? [];
      const reviewStep = {
        stage: 'score' as const,
        status: (entity.matched ? 'ok' : 'warn') as 'ok' | 'warn',
        title: 'LLM review',
        detail: `${chosen ? `kept/chose "${after}"` : 'no faithful candidate → unmatched'}${changed ? ` (was "${before}")` : ''} · ${d.rationale}`,
        data: { chosenCode: d.chosenCode ?? null, rationale: d.rationale, changed }
      };
      const resultIdx = steps.length && steps[steps.length - 1].stage === 'result' ? steps.length - 1 : steps.length;
      steps.splice(resultIdx, 0, reviewStep);
      entity.trace.matched = entity.matched;
      const resultStep = steps[steps.length - 1];
      if (resultStep && resultStep.stage === 'result') {
        resultStep.status = entity.matched ? 'ok' : 'fail';
        resultStep.title = entity.matched ? 'Matched to SNOMED CT' : 'Unresolved';
        resultStep.detail = entity.matched ? `${entity.snomed.code} | ${entity.snomed.display}` : entity.snomed.expression;
        resultStep.data = entity.matched
          ? { code: entity.snomed.code, display: entity.snomed.display }
          : { reason: entity.snomed.expression };
      }
    }
    const costTag = result.cached ? 'review cached' : `review $${result.cost}`;
    return ` (+ ${costTag}, ${jobs.length} reviewed)`;
  }

  /**
   * Phase 3b — agentic fallback. For each entity still unresolved after the
   * deterministic cascade and the review, let the coding agent drive the search
   * itself (reword / broaden / ECL ancestors) via the expand/lookup tools, and
   * accept its decision. Runs sequentially over the few leftovers. Returns a
   * status fragment with the cost and how many it coded.
   */
  private async runCodingAgent(entities: any[]): Promise<string> {
    const unresolved = entities.filter((e: any) => !e.matched);
    if (!unresolved.length) { return ''; }
    let spent = 0;
    let coded = 0;
    let idx = 0;
    // Human-readable description of a tool action for the live status line.
    const describe = (a: { name: string; args: any }): string => {
      if (a.name === 'lookup') { return `looking up ${a.args?.code ?? ''}`; }
      const ecl = String(a.args?.ecl ?? '');
      if (ecl.trim().startsWith('>')) { return `finding ancestors of ${ecl.replace(/[^0-9]/g, '') || 'concept'}`; }
      return `searching "${a.args?.filter ?? a.args?.ecl ?? ''}"`;
    };
    for (const entity of unresolved) {
      idx++;
      this.status = `Phase 3/3 · Auto-coding agent (${idx} of ${unresolved.length}) · "${entity.text}"…`;
      let dec: any = null;
      try {
        dec = await this.codingAgent.codeEntity(entity, (a) => {
          this.status = `Phase 3/3 · Agent (${idx}/${unresolved.length}) · "${entity.text}" → ${describe(a)}`;
        });
      } catch (err: any) {
        console.warn('Coding agent failed for', entity.text, err?.message);
      }
      spent += parseFloat(dec?.cost || '0') || 0;
      const steps = entity.trace?.steps ?? [];
      const resultIdx = steps.length && steps[steps.length - 1].stage === 'result' ? steps.length - 1 : steps.length;
      if (dec && dec.code) {
        entity.snomed = { code: String(dec.code), display: dec.display };
        entity.matched = true;
        coded++;
        steps.splice(resultIdx, 0, {
          stage: 'score', status: 'ok', title: 'Auto-coding agent',
          detail: `chose "${dec.display}" · rung ${dec.rungReached ?? '?'} · ${(dec.toolTrace || []).length} tool call(s) · ${dec.rationale || ''}`,
          data: { code: dec.code, display: dec.display, rungReached: dec.rungReached, confidence: dec.confidence, rationale: dec.rationale, toolCalls: (dec.toolTrace || []).length }
        });
      } else {
        steps.splice(resultIdx, 0, {
          stage: 'score', status: 'warn', title: 'Auto-coding agent',
          detail: `no faithful concept · ${(dec?.toolTrace || []).length} tool call(s) · ${dec?.rationale || ''}`,
          data: { rationale: dec?.rationale, toolCalls: (dec?.toolTrace || []).length }
        });
      }
      // Refresh the trailing result step to reflect the agent's decision.
      entity.trace.matched = entity.matched;
      const resultStep = steps[steps.length - 1];
      if (resultStep && resultStep.stage === 'result') {
        resultStep.status = entity.matched ? 'ok' : 'fail';
        resultStep.title = entity.matched ? 'Matched to SNOMED CT' : 'Unresolved';
        resultStep.detail = entity.matched ? `${entity.snomed.code} | ${entity.snomed.display}` : (entity.snomed?.expression || 'No match found');
        resultStep.data = entity.matched
          ? { code: entity.snomed.code, display: entity.snomed.display }
          : { reason: entity.snomed?.expression || 'unresolved' };
      }
    }
    return ` (+ agent $${spent.toFixed(4)}, ${coded}/${unresolved.length} coded)`;
  }

  /**
   * Query Snowstorm for a term and score every candidate for the trace.
   * With `fuzzy`, appends Snowstorm's `~` operator to tolerate typos/variants.
   */
  private async searchCandidates(term: string, type: string, fuzzy: boolean = false, filterOverride?: string): Promise<TraceCandidate[]> {
    // `term` is what candidates are scored against (coverage/distance);
    // `filterOverride` lets a pass send a different string to the server
    // (e.g. word prefixes) while still scoring against the real term.
    const filter = filterOverride ?? (fuzzy ? `${term}~` : term);
    const response = await this.terminologyService.matchText(filter, type, this.tuning.candidateCount).toPromise();
    const queryTokens = this.tokenize(term);
    const queryNorm = this.normText(term);
    const queryWords = new Set(queryNorm.split(' '));
    return (response?.expansion?.contains || []).map((c: any, idx: number) => {
      const clean = this.removeSemtag(c.display);
      // Polarity flip: the candidate carries an absence/negation word the query
      // does not (e.g. query "sputum production" → candidate "No sputum"). Such a
      // concept contradicts the finding and must not be accepted over ∅.
      const polarityBad = this.normText(clean).split(' ')
        .some(w => NlpFunctionComponent.NEG_WORDS.has(w) && !queryWords.has(w));
      return {
        code: c.code,
        display: c.display,
        // Distance/coverage are measured against the clean term (no fuzzy '~'),
        // case-insensitive so casing differences don't inflate them.
        distance: this.levenshteinDistance(term.toLowerCase(), clean.toLowerCase()),
        coverage: this.tokenCoverage(queryTokens, clean),
        extra: this.extraTokens(queryTokens, clean),
        exact: this.normText(clean) === queryNorm,
        polarityBad,
        rank: idx
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

  /** Two content tokens are equivalent if they share a >=4-char stem prefix, so
   *  morphological variants match (hypertension/hypertensive, respiration/
   *  respiratory) without a full stemmer, while unrelated words do not. */
  private sharesStem(a: string, b: string): boolean {
    return a === b || (a.length >= 4 && b.length >= 4 && a.slice(0, 4) === b.slice(0, 4));
  }

  /** Fraction of the query's content tokens present in the candidate display,
   *  counting morphological variants (see sharesStem) as present. */
  private tokenCoverage(queryTokens: string[], display: string): number {
    if (!queryTokens.length) return 0;
    const dt = this.tokenize(display);
    const matched = queryTokens.filter(t => dt.some(d => this.sharesStem(t, d))).length;
    return matched / queryTokens.length;
  }

  /** First 3 letters of each content token, as a broadening server filter. */
  private prefixTerm(term: string): string {
    return this.tokenize(term).map(t => t.slice(0, 3)).join(' ');
  }

  /** How many of the candidate's content tokens are NOT in the query (extra
   * qualifiers) — used to prefer the most on-target concept over an
   * over-specific one that merely shares a word. */
  private extraTokens(queryTokens: string[], display: string): number {
    const qs = new Set(queryTokens);
    return this.tokenize(display).filter(t => !qs.has(t)).length;
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

  /** Drop parenthetical groups (brand/synonym alternatives) from a search term. */
  private stripParens(text: string): string {
    const t = (text || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
    return t || text;
  }

  removeSemtag(text: string): string {
    // Only strip a TRAILING semantic tag, i.e. a parenthetical at the very end
    // ("Hypertensive disorder (disorder)"). Do NOT strip a mid-string
    // parenthetical that is followed by more text — in product names like
    // "Clopidogrel (as clopidogrel bisulfate) 300 mg oral tablet" the "(as …)"
    // is part of the name, and stripping it would make a dose-specific product
    // score as if it were the plain generic (exact match, zero extra tokens).
    const t = (text || '').trim();
    if (t.endsWith(')')) {
      const index = t.lastIndexOf('(');
      if (index > 0) {
        return t.substring(0, index).trim();
      }
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