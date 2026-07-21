import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { TuningService } from '../services/tuning.service';

/**
 * Lets the user tune the terminology-matching cascade. Edits the shared
 * TuningService directly (so changes apply to the next run) and can restore
 * defaults.
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
    private dialogRef: MatDialogRef<AlgorithmTuningDialogComponent>
  ) {}

  reset(): void {
    this.tuning.reset();
  }

  done(): void {
    this.tuning.save();
    this.dialogRef.close();
  }
}
