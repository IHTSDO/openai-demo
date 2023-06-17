import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';

@Directive({
  selector: '[appHighlightTooltip]'
})
export class HighlightTooltipDirective implements OnChanges {
  @Input() entities: any[] = [];

  constructor(private el: ElementRef) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes["entities"]) {
      this.removeHighlights();
      this.highlightEntities();
    }
  }

  private highlightEntities() {
    const text = this.el.nativeElement.innerText;
    let newInnerHtml = text;
    let lastIndex = 0;

    for (const entity of this.entities) {
      var regEx = new RegExp(entity.text, "i");
      // set local type based on the entity type, F = Finding, P = Procedure, M = Medication, Mo = Morphology
      var localType = entity.type;
      if (entity.type == "F") {
        localType = "Finding";
      } else if (entity.type == "P") {
        localType = "Procedure";
      } else if (entity.type == "M") {
        localType = "Medication";
      } else if (entity.type == "Mo") {
        localType = "Morphology";
      } else if (entity.type == "B") {
        localType = "BodyStructure";
      }
      newInnerHtml = newInnerHtml.replace(regEx,`
      <mark class="tooltip ${localType} ${entity.context}">
        ${entity.text}
        <span class="tooltiptext">
          ${localType}, ${entity.context}<br>${entity.singularFsn}<br>${entity.snomed?.code} ${entity.snomed?.display}
        </span>
      </mark>
      `);
    }

    this.el.nativeElement.innerHTML = newInnerHtml;
  }

  private removeHighlights() {
    this.el.nativeElement.innerHTML = this.el.nativeElement.innerText;
  }

}
