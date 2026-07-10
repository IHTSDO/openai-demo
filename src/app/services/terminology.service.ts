import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TerminologyService {

  snowstormFhirBase = 'https://snowstorm.ihtsdotools.org/snowstorm/snomed-ct/fhir';
  defaultFhirUrlParam = 'http://snomed.info/sct'; // 'http://snomed.info/sct/11000221109/version/20211130'
  fhirUrlParam = this.defaultFhirUrlParam;
  lang = 'en';

  constructor(private http: HttpClient) { }

  setSnowstormFhirBase(url: string) {
    this.snowstormFhirBase = url;
  }
  
  setFhirUrlParam(url: string) {
    this.fhirUrlParam = url;
  }

  setLang(lang: string) {
    this.lang = lang;
  }

  getCodeSystems() {
    let requestUrl = `${this.snowstormFhirBase}/CodeSystem`;
    return this.http.get<any>(requestUrl)
      .pipe(
        catchError(this.handleError<any>('getCodeSystems', {}))
      );
  }

  getValueSetExpansionUrl(ecl: string, terms: string, offset?: number, count?:number) {
    if (!offset) offset = 0;
    if (!count) count = 20;
    if (typeof terms != 'string') {
      terms = '';
    }
    return `${this.snowstormFhirBase}/ValueSet/$expand?url=${this.fhirUrlParam}?fhir_vs=ecl/${encodeURIComponent(ecl)}&count=${count}&offset=${offset}&filter=${terms}&language=${this.lang}`
  }

  expandValueSet(ecl: string, terms: string, offset?: number, count?:number): Observable<any> {
    let requestUrl = this.getValueSetExpansionUrl(ecl, terms, offset, count);
    return this.http.get<any>(requestUrl)
      .pipe(
        catchError(this.handleError<any>('expandValueSet', {}))
      );
  }

  /**
   * Maps an entity type code to the ECL hierarchy it is searched within, plus
   * a human-readable label for tracing/visualization. Kept here (not in the
   * component) so the query and its description never drift apart.
   */
  eclForType(type: string): { ecl: string; label: string } {
    switch (type) {
      case 'F':  return { ecl: `<< 404684003 |Clinical finding|`, label: 'Clinical finding' };
      case 'P':  return { ecl: `<< 71388002 |Procedure|`, label: 'Procedure' };
      case 'M':  return { ecl: `<< 373873005 |Pharmaceutical / biologic product (product)|`, label: 'Pharmaceutical / biologic product' };
      // A found morphology is searched as a clinical finding.
      case 'Mo': return { ecl: `<< 404684003 |Clinical finding|`, label: 'Clinical finding (morphology → finding)' };
      case 'B':  return { ecl: `<< 123037004 |Body structure (body structure)|`, label: 'Body structure' };
      default:   return { ecl: '', label: `(unknown type "${type}")` };
    }
  }

  matchText(text: string, type: string, count: number = 5): Observable<any> {
    if (text.length < 3) {
      return of([]);
    }
    const { ecl } = this.eclForType(type);
    if (!ecl) {
      return of([]);
    }
    return this.expandValueSet(ecl, text, 0, count).pipe(
      catchError(this.handleError<any>('expandValueSet', {}))
    );
  }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
  
      // TODO: send the error to remote logging infrastructure
      // console.error(error); // log to console instead
  
      // TODO: better job of transforming error for user consumption
      // console.log(`${operation} failed: ${error.message}`);
  
      // Let the app keep running by returning an empty result.
      return of(result as T);
    };
  }

  /**
   * All terms for a concept (PT/display + every designation/synonym), via
   * FHIR CodeSystem/$lookup. Used to score token coverage against synonyms,
   * not only the returned preferred term.
   */
  conceptTerms(conceptId: string): Observable<string[]> {
    return this.lookupConcept(conceptId).pipe(
      map((res: any) => {
        const terms: string[] = [];
        for (const p of res?.parameter || []) {
          if (p.name === 'display' && p.valueString) {
            terms.push(p.valueString);
          } else if (p.name === 'designation') {
            const value = (p.part || []).find((x: any) => x.name === 'value');
            if (value?.valueString) {
              terms.push(value.valueString);
            }
          }
        }
        return terms;
      }),
      catchError(this.handleError<string[]>('conceptTerms', []))
    );
  }

  lookupConcept(conceptId: string) {
    // https://dev-is-browser.ihtsdotools.org/fhir/CodeSystem/$lookup?system=http://snomed.info/sct&code=313307000
    let requestUrl = `${this.snowstormFhirBase}/CodeSystem/$lookup?system=http://snomed.info/sct&code=${conceptId}`;
    return this.http.get<any>(requestUrl)
      .pipe(
        catchError(this.handleError<any>('lookupConcept', {}))
      );
  }
}
