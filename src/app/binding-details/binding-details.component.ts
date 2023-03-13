import { Component, OnInit, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TerminologyService } from '../services/terminology.service';

@Component({
  selector: 'app-binding-details',
  templateUrl: './binding-details.component.html',
  styleUrls: ['./binding-details.component.css']
})
export class BindingDetailsComponent implements OnInit {

  expansion: any[] | undefined;
  total: any;
  loading = false;
  expandUrl = '';
  expansionLength = 0;

  constructor(
    public dialogRef: MatDialogRef<BindingDetailsComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    public terminologyService: TerminologyService
  ) {}

  onNoClick(): void {
    this.dialogRef.close();
  }

  ngOnInit(): void {
    this.loadExpansion(true);
  }

  loadPage() {
    this.loadExpansion(false);
  }

  loadExpansion(clear: boolean) {
    let offset = this.expansion?.length;
    if (clear) {
      this.expansion = [];
      this.total = '-';
      this.expansionLength = 0;
      offset = 0;
    }
    this.loading = true;
    this.expandUrl = this.terminologyService.getValueSetExpansionUrl(this.data.ecl, '');
    this.terminologyService.expandValueSet(this.data.ecl, '', offset, 20).subscribe(response => {
      if (!response.issue) {
        this.expansion = this.expansion?.concat(response.expansion?.contains);
        this.total = response.expansion?.total;
        this.expansionLength = (this.expansion) ? this.expansion.length : 0
      } else {
        this.expansion = [];
        this.total = '-';
        this.expansionLength = 0;
        console.log(response.issue.diagnostics)
      }
      this.loading = false;
    } );
  }

}
