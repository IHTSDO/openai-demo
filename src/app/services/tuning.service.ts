import { Injectable } from '@angular/core';

/**
 * Tunable parameters for the terminology-matching cascade. Single source of
 * truth shared by the matching code and the "Algorithm tuning" dialog;
 * persisted in localStorage. Call reset() to restore defaults.
 */
@Injectable({ providedIn: 'root' })
export class TuningService {
  private static readonly KEY = 'sctTuning';
  static readonly DEFAULTS = {
    coverageMin: 0.5,        // min fraction of query tokens the candidate must contain
    distanceMax: 50,         // max Levenshtein distance to accept
    candidateCount: 5,       // candidates fetched per $expand
    enableSynonymLookup: true, // $lookup rescue against synonyms
    enableGeneralTerm: true,   // broader "general term" pass
    enableFuzzy: true,         // fuzzy (~) fallback pass
    enablePrefixSearch: false, // last-resort prefix pass (first 3 letters/word), off by default
  };

  coverageMin = TuningService.DEFAULTS.coverageMin;
  distanceMax = TuningService.DEFAULTS.distanceMax;
  candidateCount = TuningService.DEFAULTS.candidateCount;
  enableSynonymLookup = TuningService.DEFAULTS.enableSynonymLookup;
  enableGeneralTerm = TuningService.DEFAULTS.enableGeneralTerm;
  enableFuzzy = TuningService.DEFAULTS.enableFuzzy;
  enablePrefixSearch = TuningService.DEFAULTS.enablePrefixSearch;

  constructor() {
    this.load();
  }

  reset(): void {
    Object.assign(this, TuningService.DEFAULTS);
    this.save();
  }

  /** True when a parameter differs from its default value. */
  isChanged(key: string): boolean {
    return (this as any)[key] !== (TuningService.DEFAULTS as any)[key];
  }

  /** How many parameters differ from their defaults. */
  get changedCount(): number {
    return Object.keys(TuningService.DEFAULTS).filter(k => this.isChanged(k)).length;
  }

  save(): void {
    try {
      localStorage.setItem(TuningService.KEY, JSON.stringify(this.snapshot()));
    } catch { /* best-effort */ }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(TuningService.KEY);
      if (raw) {
        Object.assign(this, { ...TuningService.DEFAULTS, ...JSON.parse(raw) });
      }
    } catch { /* ignore corrupt value */ }
  }

  private snapshot() {
    const { coverageMin, distanceMax, candidateCount, enableSynonymLookup, enableGeneralTerm, enableFuzzy } = this;
    return { coverageMin, distanceMax, candidateCount, enableSynonymLookup, enableGeneralTerm, enableFuzzy };
  }
}
