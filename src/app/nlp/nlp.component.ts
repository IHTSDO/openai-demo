import { Component, Input, OnInit } from '@angular/core';
import { Configuration, OpenAIApi } from 'openai';
import { TerminologyService } from '../services/terminology.service';
import { OpenaiService } from '../services/openai.service';

@Component({
  selector: 'app-nlp',
  templateUrl: './nlp.component.html',
  styleUrls: ['./nlp.component.css']
})
export class NlpComponent implements OnInit {
  @Input() apiKey: string = "";

  clinicalText = "An 80-year-old woman was admitted with pancytopenia. Five weeks earlier, nausea, vomiting, diarrhea, chills, and no fever had developed. CT revealed bilateral pelvic masses; examination of a peripheral-blood smear revealed schistocytes, anisocytosis, and a low platelet count. ";
  nlpResult = "";
  loadingNlp = false; 
  entities: any[] = [];
  displayedColumns: string[] = ['text', 'singularFsn', 'type', 'context', 'snomed'];
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

  constructor(private terminologyService: TerminologyService, private openaiService: OpenaiService) { }

  ngOnInit(): void {
  }

  async runNlp(): Promise<void> {
    try {
      this.status = 'Extracting clinical entities...';
      this.loadingNlp = true;
      this.nlpResult = "";
      this.entities = [];
      const configuration = new Configuration({
        apiKey: this.apiKey
      });
      const openai = new OpenAIApi(configuration);
      
      const systemPrompt = {role: "system", content: `You are a npm entity extractor. Report results as a JSON array of objects. 
      Detect as much entities from the user input as possible. If an entity has a modifiers, such as laterality or severity, 
      detect only the main entity and report the modifier in the corresponding property of the json object.
      Don't include demographic information, like "80 years old woman".
      Provide the following information for each entity:
       \n  - text: the text of the entity
       \n  - type: the type of the entity (F for finding, P for procedure, M for medication, Mo for morphology)
       \n  - context: present or absent
       \n  - fsn: the fully specified name of the entity
       \n  - singularFsn: the fully specified name transformed to the singular form, and remove any laterality or severity modifier, use clinical words
       \n  - laterality: the laterality of the entity, if any.
       \n  - severity: the severity of the entity, if any.
       \n  - synonyms: a list of synonyms for the fully specified name`};
      const completion = await this.openaiService.completion([systemPrompt, {role: "user", content: this.clinicalText}], 3000, 0);
      const response = completion.data.choices[0].message?.content;
      if (response) {
        try {
          this.entities = JSON.parse(response);
          // normalize entity.type finding = F, procedure = P, medication = M, morphology = Mo
          this.entities.forEach((entity: any) => {
            if (entity.type == "finding") {
              entity.type = "F";
            } else if (entity.type == "procedure") {
              entity.type = "P";
            } else if (entity.type == "medication") {
              entity.type = "M";
            } else if (entity.type == "morphology") {
              entity.type = "Mo";
            }
            if (!entity.fsn?.length) { entity.fsn = entity.text; }
            if (!entity.singularFsn) { entity.singularFsn = entity.fsn; }
          });
          this.entities = this.entities.filter((entity: any) => 
            entity.type == "F" || entity.type == "Mo" || entity.type == "P" || entity.type == "M"
            );
          // removed repeated entities matching on singularFsn
          this.entities = this.entities.filter((entity: any, index: number, self: any) =>
            index === self.findIndex((t: any) => (
              t.singularFsn === entity.singularFsn
            ))
          );
          this.status = `Found ${this.entities.length} clinical entities. Matching with SNOMED CT`;
          await this.matchWithSnomed(this.entities);
          this.nlpResult = JSON.stringify(this.entities, null, 2);
          // remove entities with snomed.expression = No match found
          this.entities = this.entities.filter((entity: any) => entity.snomed?.expression != "No match found");
        } catch(err: any) {
          this.nlpResult = err.message;
          this.status = err.message;
        }
      }
      this.loadingNlp = false;
    } catch(err: any) {
      this.loadingNlp = false;
      this.nlpResult = "Error: " + err.message;
    }
  }

  async asyncForEach(array: any[], callback: any) {
    for (let i = 0; i < array.length; i++) {
      await callback(array[i], i, array);
    }
  }
  
  async matchWithSnomed(entities: any[]) {
    let count = 0;
    let baseStatus = this.status;
    await this.asyncForEach(entities, async (entity: any) => {
      count++;
      entity.singularFsn = this.removeSemtag(entity.singularFsn);
      this.status = baseStatus + ' (' + count + ' of ' + entities.length + ')...';
      let response = await this.terminologyService.matchText(entity.singularFsn, entity.type).toPromise();
      if (response?.expansion?.contains?.length > 0) {
        const distance = this.levenshteinDistance(entity.singularFsn, this.removeSemtag(response.expansion.contains[0].display));
        if (distance < 50) {
          entity.snomed = response.expansion.contains[0];
        }
      } else if (entity.synonyms?.length > 0) {
        let response = await this.terminologyService.matchText(entity.synonyms[0], entity.type).toPromise();
        if (response?.expansion?.contains?.length > 0) {
          const distance = this.levenshteinDistance(entity.singularFsn, this.removeSemtag(response.expansion.contains[0].display));
          if (distance < 50) {
            entity.snomed = response.expansion.contains[0];
          }
        }
      }
      if (entity.snomed) {
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
        entity.snomed = {expression: "No match found"};
      }
    });
    this.status = `Found ${this.entities.length} clinical entities.`;
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