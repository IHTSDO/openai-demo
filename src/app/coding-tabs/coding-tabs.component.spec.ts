import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CodingTabsComponent } from './coding-tabs.component';

describe('CodingTabsComponent', () => {
  let component: CodingTabsComponent;
  let fixture: ComponentFixture<CodingTabsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CodingTabsComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CodingTabsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
