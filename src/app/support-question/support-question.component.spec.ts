import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SupportQuestionComponent } from './support-question.component';

describe('SupportQuestionComponent', () => {
  let component: SupportQuestionComponent;
  let fixture: ComponentFixture<SupportQuestionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SupportQuestionComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SupportQuestionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
