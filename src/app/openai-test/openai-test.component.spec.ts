import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OpenaiTestComponent } from './openai-test.component';

describe('OpenaiTestComponent', () => {
  let component: OpenaiTestComponent;
  let fixture: ComponentFixture<OpenaiTestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ OpenaiTestComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OpenaiTestComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
