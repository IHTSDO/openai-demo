import { Component, OnInit } from '@angular/core';
import { CodingSpecService } from '../services/coding-spec.service';

@Component({
  selector: 'app-coding-tabs',
  templateUrl: './coding-tabs.component.html',
  styleUrls: ['./coding-tabs.component.css']
})
export class CodingTabsComponent implements OnInit {

  constructor(public codingSpecService: CodingSpecService) { }

  ngOnInit(): void {
  }

}
