import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { CookieService } from 'ngx-cookie-service';

@Component({
  selector: 'app-ai-warning-dialog',
  templateUrl: './ai-warning-dialog.component.html',
  styleUrls: ['./ai-warning-dialog.component.css']
})
export class AiWarningDialogComponent implements OnInit {

  constructor(public dialogRef: MatDialogRef<AiWarningDialogComponent>, private cookieService: CookieService) { }

  ngOnInit(): void {
    // this.cookieService.delete('aiWarningAccepted');
    this.dialogRef.disableClose = true;
    const accepted = this.cookieService.get('aiWarningAccepted');
    if (accepted === 'true') {
      this.dialogRef.close({ accepted: true });
    }
  }

  onAcceptClick(): void {
    this.cookieService.set('aiWarningAccepted', 'true', 30);
    this.dialogRef.close({ accepted: true });
  }

  onLeaveClick(): void {
    window.location.href = 'https://www.snomed.org';
    this.dialogRef.close({ accepted: false });  
  }

}
