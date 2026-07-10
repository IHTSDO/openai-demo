import { Directive, ElementRef, Input, OnChanges, SimpleChanges } from '@angular/core';
import { MatTooltip } from '@angular/material/tooltip';

@Directive({
    selector: '[appHighlightTooltip]',
    standalone: false
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
      if (!entity.text) { continue; }
      // Escape regex special characters (parentheses, slashes, etc.) so terms
      // like "CT scan (abdomen/pelvis)" don't break or silently fail to match.
      const escaped = entity.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var regEx = new RegExp(escaped, "i");
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
      // Entities detected by the LLM but not resolved on the terminology
      // server get a discreet dotted highlight and their reason in the tooltip.
      const matchClass = entity.matched ? '' : 'no-match';
      const detail = entity.matched
        ? `${entity.snomed?.code ?? ''} ${entity.snomed?.display ?? ''}`.trim()
        : (entity.snomed?.expression ?? 'No SNOMED match');
      newInnerHtml = newInnerHtml.replace(regEx,`
      <mark class="tooltip ${localType} ${entity.context} ${matchClass}">
        ${entity.text}
        <span class="tooltiptext">
          ${localType}, ${entity.context}<br>${entity.singularFsn}<br>${detail}
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
