import { Component, Input, OnInit } from '@angular/core';
import { Configuration, OpenAIApi } from 'openai';
import { TerminologyService } from '../services/terminology.service';
import { OpenaiService } from '../services/openai.service';

@Component({
  selector: 'app-nlp-function',
  templateUrl: './nlp-function.component.html',
  styleUrls: ['./nlp-function.component.css']
})
export class NlpFunctionComponent implements OnInit {
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
    this.status = 'Extracting clinical entities...';
    this.loadingNlp = true;
    this.nlpResult = "";
    this.entities = [];
    const systemPrompt = {role: "system", content: `You are a nlp clinical entity extractor. Extract clinical terms from free text clinical notes and report back with SNOMED CT codes.`};
    const functions = [
      {
        "name": "getSNOMEDCodes",
        "description": "Use this function to pass a list of clinical terms and get back SNOMED CT codes.",
        "parameters": {
          "type": "object",
          "properties": {
            "terms": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "text": {
                    "type": "string",
                    "description": "The clinical term extracted from the text"
                  },
                  "type": {
                    "type": "string",
                    "enum": ["finding", "procedure", "medication", "morphology", "body structure"],
                    "description": "The type of clinical term"
                  },
                  "context": {
                    "type": "string",
                    "enum": ["present", "absent", "unknown"],
                    "description": "The context of the term, wether is present, absent or unknown"
                  },
                  "fsn": {
                    "type": "string",
                    "description": "The fully specified name of the term. Spell out acronyms."
                  },
                  "severity": {
                    "type": "string",
                    "description": "The severity contained in the term, if any",
                    "enum": ["mild", "moderate", "severe"]
                  },
                  "laterality": {
                    "type": "string",
                    "description": "The laterality contained in the term, if any",
                    "enum": ["left", "right", "bilateral"]
                  },
                  "singularFsn": {
                    "type": "string",
                    "description": "The fsn, removing plurals"
                  }
                },
                "required": ["text", "type", "context", "singularFsn"]
              }
            }
          }
        },
      }
    ]
    const message = `Extract clinical terms and assign SNOMED CT codes to this text: ${this.clinicalText}\n`;
    const completion = await this.openaiService.completion([systemPrompt, {role: "user", content: message}], 10000, 0, functions);
    const response = completion.data.choices[0].message?.function_call;
    const functionName = response?.name;
    const functionArguments = JSON.parse(response?.arguments);
    this.entities = functionArguments?.terms;
    this.entities.forEach((entity: any) => {
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
      // remove laterality and severity from singularFsn and trim
      entity.singularFsn = entity.singularFsn.replace(/(left|right|bilateral|severe|moderate|mild)/gi, '').trim();
    });
    await this.matchWithSnomed(this.entities);
    const modelCost = 0.15;
    // remove entities with no snomed code
    this.entities = this.entities.filter((entity: any) => entity.snomed?.code?.length);
    // remove duplicates with same text
    this.entities = this.entities.filter((entity: any, index: number, self: any[]) => self.findIndex((e: any) => e.text === entity.text) === index);
    const prompt_tokens = completion?.data?.usage?.prompt_tokens;
    const completion_tokens = completion?.data?.usage?.completion_tokens;
    const cost = (prompt_tokens / 1000000 * modelCost + completion_tokens / 1000000 * modelCost).toFixed(4);
    this.nlpResult = JSON.stringify(this.entities, null, 2);
    this.status = `Extracted ${this.entities.length} clinical entities. Cost: $${cost}`;
    // const functionPrompt = {role: "function", name: functionName, content: JSON.stringify(this.entities)};
    // const completion2 = await this.openaiService.completion(
    //   [
    //     systemPrompt, 
    //     {role: "user", content: message}, 
    //     completion.data.choices[0].message,
    //     functionPrompt], 1000, 0);
    // console.log(completion2);
    this.loadingNlp = false;
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