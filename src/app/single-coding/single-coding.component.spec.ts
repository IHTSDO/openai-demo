import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SingleCodingComponent } from './single-coding.component';

describe('SingleCodingComponent', () => {
  let component: SingleCodingComponent;
  let fixture: ComponentFixture<SingleCodingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SingleCodingComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SingleCodingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
