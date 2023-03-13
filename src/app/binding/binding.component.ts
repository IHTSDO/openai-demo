import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'app-binding',
  templateUrl: './binding.component.html',
  styleUrls: ['./binding.component.css']
})
export class BindingComponent implements OnInit {

  @Input() bindings: any[] = [];

  constructor() { }

  ngOnInit(): void {
  }

}
