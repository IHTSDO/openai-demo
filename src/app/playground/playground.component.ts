import { Component, Input } from '@angular/core';
import { OpenaiService } from '../services/openai.service';
import { TerminologyService } from '../services/terminology.service';

@Component({
  selector: 'app-playground',
  templateUrl: './playground.component.html',
  styleUrls: ['./playground.component.css']
})
export class PlaygroundComponent {

  @Input() apiKey: string = '';
  systemPrompt: string = "Act as an entity extractor. respond only with JSON.";
  case: string = "An 80-year-old woman was admitted with pancytopenia. Five weeks earlier, nausea, vomiting, diarrhea, chills, and no fever had developed. CT revealed bilateral pelvic masses; examination of a peripheral-blood smear revealed schistocytes, anisocytosis, and a low platelet count. ";

  promptOne: string = 'Extract clinical entities from this text, including present and absent medical conditions, symptoms, procedures, and procedure findings. Text:';
  promptTwo: string = 'Add a singular form, fully specified name to each entity, maintaining the original ones as different properties of an object. Respond as JSON.';
  promptThree: string = 'Remove modifiers from the singular name, and add them as properties of the entity. Respond as JSON.';
  responseOne: any = {};
  responseOneContent: string = '';
  responseTwo: any = {};
  responseTwoContent: string = '';
  responseThree: any = {};
  responseThreeContent: string = '';
  loadingResponseOne: boolean = false;
  loadingResponseTwo: boolean = false;
  loadingResponseThree: boolean = false;

  constructor(private terminologyService: TerminologyService, private openaiService: OpenaiService) { }

  async runPromptOne() {
    this.loadingResponseOne = true;
    this.responseOne = {};
    this.responseOneContent = '';
    const prompt = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: this.promptOne + this.case}
    ];
    const completion = await this.openaiService.completion(prompt, 3000, 0);
    this.responseOne = completion.data.choices[0]?.message;
    this.responseOneContent = JSON.parse(this.responseOne.content);
    this.loadingResponseOne = false;
  }
  async runPromptTwo() {
    this.loadingResponseTwo = true;
    this.responseTwo = {};
    this.responseTwoContent = '';
    const prompt = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: this.promptOne },
      this.responseOne,
      { role: 'user', content: this.promptTwo}
    ];
    const completion = await this.openaiService.completion(prompt, 3000, 0);
    this.responseTwo = completion.data.choices[0]?.message;
    this.responseTwoContent = JSON.parse(this.responseTwo.content);
    this.loadingResponseTwo = false;
  }

  async runPromptThree() {
    this.loadingResponseThree = true;
    this.responseThree = {};
    this.responseThreeContent = '';
    const prompt = [
      { role: 'system', content: this.systemPrompt },
      { role: 'user', content: this.promptOne },
      this.responseOne,
      { role: 'user', content: this.promptTwo},
      this.responseTwo,
      { role: 'user', content: this.promptThree}
    ];
    const completion = await this.openaiService.completion(prompt, 3000, 0);
    this.responseThree = completion.data.choices[0]?.message;
    this.responseThreeContent = JSON.parse(this.responseThree.content);
    this.loadingResponseThree = false;
  }
}
