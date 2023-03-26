import { Component, Input, OnInit } from '@angular/core';
import { OpenaiService } from '../services/openai.service';

@Component({
  selector: 'app-ecl-explain',
  templateUrl: './ecl-explain.component.html',
  styleUrls: ['./ecl-explain.component.css']
})
export class EclExplainComponent implements OnInit {
  @Input() apiKey: string = "";

  eclToExplain = `<  404684003 | Clinical finding| : 
            363698007 | Finding site|  = 
          <<  39057004 | Pulmonary valve structure|  AND 
            116676008 | Associated morphology|  = 
          <<  415582006 | Stenosis|`;
  explainResult = "";
  loadingExplain = false;

  constructor(private openaiService: OpenaiService) { }

  ngOnInit(): void {
  }

  async runEclExplanation(): Promise<void> {
    try {
      this.loadingExplain = true;
      this.explainResult = "";
      const ecl = this.eclToExplain.replace(/(\r\n|\n|\r)/gm, "");
      const prompt = [ {role: "user", content: `Explain this SNOMED CT constraint query expression "${ecl}"`}];
      const completion = await this.openaiService.completion(prompt, 1000, 0.8);
      const response = completion.data.choices[0].message?.content;
      if (response) {
        this.explainResult = response.replace(/\"/g, '');
      }
      this.loadingExplain = false;
    } catch(err) {
      this.loadingExplain = false;
      this.explainResult = "Error";
    }
  }

}
