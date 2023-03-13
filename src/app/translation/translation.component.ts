import { Component, Input, OnInit } from '@angular/core';
import { OpenaiService } from '../services/openai.service';

@Component({
  selector: 'app-translation',
  templateUrl: './translation.component.html',
  styleUrls: ['./translation.component.css']
})
export class TranslationComponent implements OnInit {
  @Input() apiKey: string = "";

  language = "Spanish";
  languages = ["Spanish", "Danish", "French", "German", "Swedish","English", "Korean", "Indonesian"];
  terms = [
    'Total replacement of hip (procedure)',
    'Neonatal aspiration pneumonia (disorder)',
    'Cramping pain (finding)',
    'Product containing precisely atenolol 50 milligram/1 each conventional release oral tablet (clinical drug)'
  ]
  sourceText = this.terms[0];
  translationResult = "";
  loadingTranslation = false;

  constructor(private openaiService: OpenaiService) { }

  ngOnInit(): void {
  }

  run(term: string) {
    this.sourceText = term;
    this.runTranslation();
  }

  async runTranslation(): Promise<void> {
    try {
      this.loadingTranslation = true;
      this.translationResult = "";
      const prompt = [ {role: "user", content: `Translate to ${this.language} this SNOMED CT clinical description "${this.sourceText}"`}];
      const completion = await this.openaiService.completion(prompt, 500, 0.8);
      const response = completion.data.choices[0].message?.content;
      if (response) {
        this.translationResult = response.slice(2).replace(/\"/g, '');
        if (this.translationResult.endsWith(".")) {
          this.translationResult = this.translationResult.slice(0, -1);
        }
      }
      this.loadingTranslation = false;
    } catch(err) {
      this.loadingTranslation = false;
      this.translationResult = "Error";
    }
  }

}
