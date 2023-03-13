import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { TerminologyService } from '../services/terminology.service';
import { UntypedFormControl } from '@angular/forms';
import {debounceTime, distinctUntilChanged, map, startWith, switchMap,tap} from 'rxjs/operators';
import {Observable, of, Subject} from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { BindingDetailsComponent } from '../binding-details/binding-details.component';

@Component({
  selector: 'app-autocomplete-binding',
  templateUrl: './autocomplete-binding.component.html',
  styleUrls: ['./autocomplete-binding.component.css']
})
export class AutocompleteBindingComponent implements OnInit {
  formControl = new UntypedFormControl();
  autoFilter: Observable<any> | undefined;
  @Input() binding: any;
  @Output() selectionChange = new EventEmitter<any>();
  loading = false;
  selectedConcept: any = {};
  
  constructor(private terminologyService: TerminologyService, public dialog: MatDialog) { }

  ngOnInit(): void {
    this.autoFilter = this.formControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((term: string) =>  {
        this.loading = true;
        let response = this.terminologyService.expandValueSet(this.binding.ecl, term);
        return response;
      }),
      tap(data => {
        this.loading = false;
      })
    );  
  }

  optionSelected(value: any) {
    this.selectedConcept = value;
    this.selectionChange.emit(value);
  }

  openDialog(): void {
    const dialogRef = this.dialog.open(BindingDetailsComponent, {
      height: '90%',
      width: '70%',
      data: this.binding
    });

    dialogRef.afterClosed().subscribe(result => {
      // console.log('The dialog was closed');
    });
  }

  change(event: any) {
    const item = event?.option?.value;
    this.optionSelected({ code: item.code, display: item.display, annotation: this.binding.annotations[item.code], definition: '' });
  }

}