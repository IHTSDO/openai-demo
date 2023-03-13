import { Component, Input, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { BindingDetailsComponent } from '../binding-details/binding-details.component';
import { TerminologyService } from '../services/terminology.service';

@Component({
  selector: 'app-dropdown-binding',
  templateUrl: './dropdown-binding.component.html',
  styleUrls: ['./dropdown-binding.component.css']
})
export class DropdownBindingComponent implements OnInit {
  @Input() binding: any;
  options: any[] | undefined;

  constructor(private terminologyService: TerminologyService, public dialog: MatDialog) { }

  ngOnInit(): void {
    this.terminologyService.expandValueSet(this.binding.ecl, '').subscribe(response => this.options = response.expansion.contains)
  }

  openDialog(): void {
    const dialogRef = this.dialog.open(BindingDetailsComponent, {
      height: '85%',
      width: '70%',
      data: this.binding
    });

    dialogRef.afterClosed().subscribe(result => {
      // console.log('The dialog was closed');
    });
  }

}
