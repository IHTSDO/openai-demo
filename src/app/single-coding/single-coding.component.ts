import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TerminologyService } from '../services/terminology.service';

@Component({
  selector: 'app-single-coding',
  templateUrl: './single-coding.component.html',
  styleUrls: ['./single-coding.component.css']
})
export class SingleCodingComponent implements OnInit {

  today  = new Date().toLocaleDateString("en", {year:"numeric", day:"2-digit", month:"2-digit"});
  selectedConcept: any;
  problems: any[] = [];
  loadingDefinitions = false;
  hasLogo = false;
  logo = '';

  binding:any = {
    title: 'Search clinical problem (try "Epileptic seizure" or "Hyaline fibromatosis")',
    type: 'autocomplete',
    ecl: `<< 404684003 |Clinical finding (finding)|`,
    value: '',
    note: 'Diagnosis.',
    hide: true,
    annotations: {
      "313307000" : `Use for:
      <ul>
        <li>Epileptic seizures of unknown onset or where the confidence of onset is < 80%</li>
      </ul>
      Do not use for:
      <ul>
        <li>Epileptic seizures where the clinician is ≥ 80% confident of a generalized onset</li>
        <li>Epileptic seizures where the clinician is ≥ 80% confident of a focal  onset</li>
      </ul>
      <a href="https://www.epilepsydiagnosis.org" target="_blank">https://www.epilepsydiagnosis.org</a>
      `,
      "246545002" : `Use for:
      <ul>
        <li>Epileptic seizures where the clinician is ≥ 80% confident of a generalized onset</li>
      </ul>
      Do not use for:
      <ul>
        <li>Epileptic seizures of focal onset, unknown onset or where the confidence of onset is < 80%</li>
      </ul>
      <a href="https://www.epilepsydiagnosis.org" target="_blank">https://www.epilepsydiagnosis.org</a>
      `,
      "1208961006": ' ',
      "1236975007": ' ',
      "192993002": ' ',
      "192991000": ' ',
      "1217136003": ' ',
      "1208960007": ' ',
      "192981006": ' '

    }
  }

  constructor(private _snackBar: MatSnackBar,
    private terminologyService: TerminologyService) {}

  openSnackBar() {
    this._snackBar.openFromComponent(NotImplementedAlertComponent, {
      duration: 5 * 1000,
    });
  }

  setSelectedConcept(problem: any) {
    this.selectedConcept = problem;
    this.loadingDefinitions = true;
    this.terminologyService.lookupConcept(problem.code).subscribe(response => {
      response.parameter.forEach((o: any) => {
        if (o.name == "designation") {
          let isDef: boolean = false;
          o.part.forEach( (p: any) => {
            if (p.name == "use" && p.valueCoding.code == "900000000000550004") {
              isDef = true;
            }
          });
          if (isDef) {
            o.part.forEach( (p: any) => {
              if (p.name == "value") {
                this.selectedConcept.definition = p.valueString;
              }
            });
          }
        }
      });
      this.loadingDefinitions = false;
    });
    this.hasLogo = false;
    const ecl = `${problem.code} AND ^ 784008009 |SNOMED CT to Orphanet simple map|`;
    this.terminologyService.expandValueSet(ecl, '').subscribe(response => {
      if (response?.expansion?.total > 0) {
        this.hasLogo = true;
        this.logo = 'orphanet.png';
      }
    });
    if (this.binding.annotations[problem.code]) { //  || problem.display.includes('epileptic seizure')
      this.hasLogo = true;
      this.logo = 'ilae-logo.png';
    }
  }

  addProblem(event: any) {
    this.problems.push(this.selectedConcept)
    this.selectedConcept = {};
    this.hasLogo = false;
    this.logo = '';
  }

  reloadCurrentPage() {
    window.location.reload();
  }

  ngOnInit(): void {
  }

}

@Component({
  selector: 'snack-bar-component-example-snack',
  templateUrl: './not-implemented-alert.html',
  styles: [
    `
    .example-alert {
      color: hotpink;
    }
  `,
  ],
})
export class NotImplementedAlertComponent {}
