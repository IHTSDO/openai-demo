import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AiWarningDialogComponent } from './ai-warning-dialog.component';

describe('AiWarningDialogComponent', () => {
  let component: AiWarningDialogComponent;
  let fixture: ComponentFixture<AiWarningDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AiWarningDialogComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AiWarningDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
