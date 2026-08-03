import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { TuningService } from '../services/tuning.service';
import { OpenaiService } from '../services/openai.service';

/**
 * Lets the user tune the terminology-matching cascade and pick the LLM model.
 * Edits the shared TuningService / OpenaiService directly (so changes apply to
 * the next run) and can restore defaults.
 */
@Component({
  selector: 'app-algorithm-tuning-dialog',
  templateUrl: './algorithm-tuning-dialog.component.html',
  styleUrls: ['./algorithm-tuning-dialog.component.css'],
  standalone: false
})
export class AlgorithmTuningDialogComponent {
  constructor(
    public tuning: TuningService,
    public openai: OpenaiService,
    private dialogRef: MatDialogRef<AlgorithmTuningDialogComponent>
  ) {}

  get models() {
    return this.openai.models;
  }

  onModelChange(id: string): void {
    this.openai.setModel(id);
  }

  reset(): void {
    this.tuning.reset();
  }

  done(): void {
    this.tuning.save();
    this.dialogRef.close();
  }
}
