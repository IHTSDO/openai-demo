import { Component, Input, OnInit } from '@angular/core';
import { OpenaiService } from '../services/openai.service';

@Component({
  selector: 'app-support-question',
  templateUrl: './support-question.component.html',
  styleUrls: ['./support-question.component.css']
})
export class SupportQuestionComponent implements OnInit {
  @Input() apiKey: string = "";

  supportResult = "";
  loadingSupportResponse = false;
  questions: any[] = [
    
    {
      title: "How should I start a translation of SNOMED CT?",
      prompt: "How should I start a translation of SNOMED CT?",
    },
    {
      title: "What is a SNOMED CT terminology server?",
      prompt: "What is a SNOMED CT terminology server?",
    },
    {
      title: "How is SNOMED use with HL7 FHIR?",
      prompt: "How is SNOMED use with HL7 FHIR?",
    },
    {
      title: "How do I obtain a SNOMED License?",
      prompt: "How do I obtain a SNOMED License?",
    },
    {
      title: "What's the difference between FULL and SNAPSHOT?",
      prompt: "In the SNOMED CT release package, what's the difference between the snapshot and the full files? which one should I use?",
    },
    {
      title: "What are the SNOMED International Managed Services?",
      prompt: "What are the SNOMED International Managed Services?",
    },
    {
      title: "What are the benefits for a country of becoming a member of SNOMED International?",
      prompt: "What are the benefits for a country of becoming a member of SNOMED International?",
    }
  ]

  supportQuestion = this.questions[0].prompt;
  constructor(private openaiService: OpenaiService) { }

  ngOnInit(): void {
  }

  askQuestion(question: string) {
    this.supportQuestion = question;
    this.runSupportQuestion();
  }

  async runSupportQuestion(): Promise<void> {
    try {
      this.loadingSupportResponse = true;
      this.supportResult = "";
      const question = this.supportQuestion.replace(/(\r\n|\n|\r)/gm, "").replace(/ +(?= )/g,'');
      const prompt  = [ {role: 'system', content: 'You are a support agent for SNOMED International, responding technical questions about SNOMED CT'}, 
                        {role: "user", content: question}];
      const completion = await this.openaiService.completion(prompt, 3000, 0.8);
      const response = completion.data.choices[0].message?.content;
      if (response) {
        this.supportResult = response.replace(/\"/g, '');
      }
      this.loadingSupportResponse = false;
    } catch(err) {
      this.loadingSupportResponse = false;
      this.supportResult = "Error";
    }
  }

}
