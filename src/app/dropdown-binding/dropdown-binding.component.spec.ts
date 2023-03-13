import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DropdownBindingComponent } from './dropdown-binding.component';

describe('DropdownBindingComponent', () => {
  let component: DropdownBindingComponent;
  let fixture: ComponentFixture<DropdownBindingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DropdownBindingComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DropdownBindingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
