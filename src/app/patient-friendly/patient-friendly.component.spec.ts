import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PatientFriendlyComponent } from './patient-friendly.component';

describe('PatientFriendlyComponent', () => {
  let component: PatientFriendlyComponent;
  let fixture: ComponentFixture<PatientFriendlyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PatientFriendlyComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PatientFriendlyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
