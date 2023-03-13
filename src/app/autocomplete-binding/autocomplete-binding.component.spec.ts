import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AutocompleteBindingComponent } from './autocomplete-binding.component';

describe('AutocompleteBindingComponent', () => {
  let component: AutocompleteBindingComponent;
  let fixture: ComponentFixture<AutocompleteBindingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AutocompleteBindingComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(AutocompleteBindingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
