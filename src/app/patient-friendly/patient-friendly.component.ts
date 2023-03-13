import { Component, Input, OnInit } from '@angular/core';
import { OpenaiService } from '../services/openai.service';

@Component({
  selector: 'app-patient-friendly',
  templateUrl: './patient-friendly.component.html',
  styleUrls: ['./patient-friendly.component.css']
})
export class PatientFriendlyComponent implements OnInit {
  @Input() apiKey: string = "";

  ptLanguage = "English";
  ptResult = "";
  loadingPt = false;

  terms = [
    'Anomic aphasia (finding)',
    'Traumatic hemotympanum (disorder)' ,
    'Pancytopenia (disorder)',
    'Ichthyosis hystrix (disorder)',
    'Salpingo-oophorectomy (procedure)',
    'Anosognosia (finding)'
  ];
  sourceTextPt = this.terms[0];


  constructor(private openaiService: OpenaiService) { }

  ngOnInit(): void {
  }

  run(term: string) {
    this.sourceTextPt = term;
    this.runPatientFriendlyVersion();
  }

  async runPatientFriendlyVersion(): Promise<void> {
    try {
      this.loadingPt = true;
      this.ptResult = "";
      const prompt = [ {role: "user", content: `Create a patient friendly term for the clinical description "${this.sourceTextPt}"`}];
      const completion = await this.openaiService.completion(prompt, 500, 0);
      const response = completion.data.choices[0].message?.content;
      if (response) {
        this.ptResult = response.slice(2).replace(/\"/g, '');
        if (this.ptResult.endsWith(".")) {
          this.ptResult = this.ptResult.slice(0, -1);
        }
      }
      this.loadingPt = false;
    } catch(err) {
      this.loadingPt = false;
      this.ptResult = "Error";
    }
  }

}
