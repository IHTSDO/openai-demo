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

  languages = [
    "Albanian",
    "Armenian",
    "Azerbaijani",
    "Basque",
    "Belarusian",
    "Bosnian",
    "Bulgarian",
    "Catalan",
    "Croatian",
    "Czech",
    "Danish",
    "Dutch",
    "English",
    "Estonian",
    "Finnish",
    "French",
    "Galician",
    "Georgian",
    "German",
    "Greek",
    "Hungarian",
    "Icelandic",
    "Irish",
    "Italian",
    "Kazakh",
    "Latvian",
    "Lithuanian",
    "Luxembourgish",
    "Macedonian",
    "Maltese",
    "Moldovan",
    "Montenegrin",
    "Norwegian",
    "Polish",
    "Portuguese",
    "Romanian",
    "Russian",
    "Serbian",
    "Slovak",
    "Slovenian",
    "Spanish",
    "Swedish",
    "Turkish",
    "Ukrainian",
    "Chinese (Mandarin)",
    "Hindi",
    "Arabic",
    "Bengali",
    "Indonesian",
    "Urdu",
    "Japanese",
    "Swahili",
    "Korean",
    "Thai"
  ];

  language = "English"

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
      const prompt = [ {role: "user", content: `Explain this term with a short phrase that a patient can understand, without repeating the source term, in ${this.language} language: "${this.sourceTextPt}"`}];
      const completion = await this.openaiService.completion(prompt, 500, 0);
      const response = completion.data.choices[0].message?.content;
      if (response) {
        this.ptResult = response.replace(/\"/g, '');
        // remove sematic tag
        this.ptResult = this.ptResult.replace(/\(.*?\)/g, '');
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
