import { Component, Input, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-typewriter',
  template: `
    <span [innerHTML]="currentText | markdown"></span>
  `,
  styleUrls: ['./typewriter.component.css']
})
export class TypewriterComponent {
  @Input() message: string = "";
  currentText = '';
  typingInterval: any;
  typingSpeed = 5; // Fixed typing speed of 25ms

  ngOnInit() {
    this.typeOutText();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['message']) {
      this.typeOutText();
    }
  }

  // Common function for typing out the text
  typeOutText() {
    if (this.typingInterval) {
      clearInterval(this.typingInterval); // Clear any ongoing interval
    }
    let index = 0;
    this.currentText = '';
    this.typingInterval = setInterval(() => {
      this.currentText = this.message.slice(0, index++);
      if (index > this.message.length) {
        clearInterval(this.typingInterval);
      }
    }, this.typingSpeed);
  }
}
