import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FhirSummarizeComponent } from './fhir-summarize.component';

describe('FhirSummarizeComponent', () => {
  let component: FhirSummarizeComponent;
  let fixture: ComponentFixture<FhirSummarizeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ FhirSummarizeComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FhirSummarizeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
