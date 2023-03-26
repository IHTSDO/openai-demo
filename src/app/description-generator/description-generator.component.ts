import { Component, Input, OnInit } from '@angular/core';
import { OpenaiService } from '../services/openai.service';

@Component({
  selector: 'app-description-generator',
  templateUrl: './description-generator.component.html',
  styleUrls: ['./description-generator.component.css']
})
export class DescriptionGeneratorComponent implements OnInit {

  @Input() apiKey: string = "";

  pcExpression = `=== 363787002 |Observable entity (observable entity)| :
  \t{ 10071010000104 |Has concept categorization status (attribute)| = 10111010000105 |Both orderable and observation concept categorization status (qualifier value)| } 
  \t{ 246093002 |Component (attribute)| = 67079006 |Glucose (substance)| } 
  \t{ 246501002 |Technique (attribute)| = 702660003 |Test strip technique (qualifier value)| } 
  \t{ 370130000 |Property (attribute)| = 705057003 |Presence (property) (qualifier value)| } 
  \t{ 370132008 |Scale type (attribute)| = 117363000 |Ordinal value (qualifier value)| } 
  \t{ 370134009 |Time aspect (attribute)| = 123029007 |Single point in time (qualifier value)| } 
  \t{ 704327008 |Direct site (attribute)| = 122575003 |Urine specimen (specimen)| }`;
  loadingPce = false;
  result = "";
  termStyle = "1";

  constructor(private openaiService: OpenaiService) { }

  ngOnInit(): void {
  }

  async runPCECompletion(): Promise<void> {
    try {
      this.loadingPce = true;
      this.result = "";
      // create expression variable with the post-coordinated expression without any control characters
      let expression = this.pcExpression.replace(/[\x00-\x1F\x7F-\x9F]/g, "");
      let prompt = `Generate a clinical term for the SNOMED CT post-coordinated expression "${expression}". Output should contain only the term. Don't mention the SNOMED CT code.`;
      if (this.termStyle === "2") {
        prompt = `Generate a clinical term for the SNOMED CT post-coordinated expression, including all attributes: "${expression}"`;
      }
      const completion = await this.openaiService.completion([{role: "user", content: prompt}], 500, 0);
      const response = completion.data.choices[0].message?.content;
      if (response) {
        this.result = response.replace(/\"/g, '');
        if (this.result.endsWith(".")) {
          this.result = this.result.slice(0, -1);
        }
      }
      this.loadingPce = false;
    } catch(err) {
      this.loadingPce = false;
      this.result = "Error";
    }
  }

}
