import { Component, Input, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-typewriter',
  template: `
    <span>{{currentText}}</span>
  `,
  styleUrls: ['./typewriter.component.css']
})
export class TypewriterComponent {
  @Input() message: string = "";
  currentText = '';

  ngOnInit() {
    let index = 0;
    let context = this;
    let ii = setInterval(() => {
      context.currentText = this.message.slice(0, index++);
      if (index > this.message.length) {
        clearInterval(ii);
      }
    }, 50);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['message']) {
      let index = 0;
      this.currentText = '';
      let context = this;
      let ii = setInterval(() => {
        context.currentText = this.message.slice(0, index++);
        if (index > this.message.length) {
          clearInterval(ii);
        }
      }, 25);
    }
  }
}
