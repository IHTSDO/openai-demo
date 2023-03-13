import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EclExplainComponent } from './ecl-explain.component';

describe('EclExplainComponent', () => {
  let component: EclExplainComponent;
  let fixture: ComponentFixture<EclExplainComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EclExplainComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EclExplainComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
