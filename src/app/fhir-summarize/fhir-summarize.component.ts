import { Component, Input, OnInit } from '@angular/core';
import { OpenaiService } from '../services/openai.service';

@Component({
  selector: 'app-fhir-summarize',
  templateUrl: './fhir-summarize.component.html',
  styleUrls: ['./fhir-summarize.component.css']
})
export class FhirSummarizeComponent implements OnInit {
  @Input() apiKey: string = "";

  fhirSummaryResult = "";
  loadingFhirSummary = false;
  fhirResource = `{
    "resourceType": "Condition",
    "id": "f202",
    "meta": {
      "security": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
          "code": "TBOO",
          "display": "taboo"
        }
      ]
    },
    "text": {
      "status": "generated",
      "div": ""
    },
    "clinicalStatus": {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
          "code": "resolved"
        }
      ]
    },
    "verificationStatus": {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
          "code": "confirmed"
        }
      ]
    },
    "category": [
      {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/condition-category",
            "code": "encounter-diagnosis"
          }
        ]
      }
    ],
    "severity": {
      "coding": [
        {
          "system": "http://snomed.info/sct",
          "code": "24484000",
          "display": "Severe"
        }
      ]
    },
    "code": {
      "coding": [
        {
          "system": "http://snomed.info/sct",
          "code": "363346000",
          "display": "Malignant neoplastic disease"
        }
      ]
    },
    "bodySite": [
      {
        "coding": [
          {
            "system": "http://snomed.info/sct",
            "code": "361355005",
            "display": "Entire head and neck"
          }
        ]
      }
    ],
    "subject": {
      "reference": "Patient/f201",
      "display": "Roel"
    },
    "onsetAge": {
      "value": 52,
      "unit": "years",
      "system": "http://unitsofmeasure.org",
      "code": "a"
    },
    "abatementAge": {
      "value": 54,
      "unit": "years",
      "system": "http://unitsofmeasure.org",
      "code": "a"
    },
    "recordedDate": "2012-12-01",
    "evidence": [
      {
        "detail": [
          {
            "reference": "DiagnosticReport/f201",
            "display": "Erasmus' diagnostic report of Roel's tumor"
          }
        ]
      }
    ]
  }`;

  constructor(private openaiService: OpenaiService) { }

  ngOnInit(): void {
  }

  async runFhirSummarization(): Promise<void> {
    try {
      this.loadingFhirSummary = true;
      this.fhirSummaryResult = "";
      const prompt = [ {role: "user", content: `Write a narrative summary of the FHIR resource "${this.fhirResource}" as a doctor would present this patient to his colleagues`}];
      const completion = await this.openaiService.completion(prompt, 1000, 0);
      const response = completion.data.choices[0].message?.content;
      if (response) {
        this.fhirSummaryResult = response.replace(/\"/g, '');
      }
      this.loadingFhirSummary = false;
    } catch(err) {
      this.loadingFhirSummary = false;
      this.fhirSummaryResult = "Error";
    }
  }

}
