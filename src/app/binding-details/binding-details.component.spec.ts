import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BindingDetailsComponent } from './binding-details.component';

describe('BindingDetailsComponent', () => {
  let component: BindingDetailsComponent;
  let fixture: ComponentFixture<BindingDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BindingDetailsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BindingDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
