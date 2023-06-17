import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NlpFunctionComponent } from './nlp-function.component';

describe('NlpComponent', () => {
  let component: NlpFunctionComponent;
  let fixture: ComponentFixture<NlpFunctionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NlpFunctionComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NlpFunctionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
