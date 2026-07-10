import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { EntityTrace } from '../nlp-function/entity-trace.model';

/**
 * Renders the pipeline flow for a single entity as a vertical, colour-coded
 * timeline (extract → normalize → search → score → result). Opened from the
 * results table so both matched and unmatched entities can be inspected.
 */
@Component({
  selector: 'app-entity-trace-dialog',
  templateUrl: './entity-trace-dialog.component.html',
  styleUrls: ['./entity-trace-dialog.component.css'],
  standalone: false
})
export class EntityTraceDialogComponent {
  entity: any;
  trace: EntityTrace;

  constructor(
    public dialogRef: MatDialogRef<EntityTraceDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.entity = data?.entity;
    this.trace = this.entity?.trace ?? { term: this.entity?.text ?? '', matched: false, steps: [] };
  }

  /** Which system produced a step, for the coloured source pill. */
  source(stage: string): { label: string; cls: string } {
    switch (stage) {
      case 'extract':
      case 'synonym':                 // clinical/general term come from the LLM extraction
        return { label: 'LLM', cls: 'src-llm' };
      case 'search':
      case 'lookup':
        return { label: 'Snowstorm', cls: 'src-snowstorm' };
      case 'normalize':
      case 'score':
        return { label: 'Local', cls: 'src-local' };
      default:
        return { label: 'Result', cls: 'src-result' };
    }
  }

  /** Format a 0..1 coverage as a percentage for the candidates table. */
  pct(x?: number): string {
    return x == null ? '' : Math.round(x * 100) + '%';
  }

  iconFor(status: string): string {
    switch (status) {
      case 'ok': return 'check_circle';
      case 'warn': return 'error';
      case 'fail': return 'cancel';
      default: return 'radio_button_unchecked';
    }
  }

  close(): void {
    this.dialogRef.close();
  }
}
