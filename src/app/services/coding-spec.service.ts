import { Injectable } from '@angular/core';
import { codingSpec } from '../coding-spec';

@Injectable({
  providedIn: 'root'
})
export class CodingSpecService {

  constructor() { }

  getCodingSpec() {
    return codingSpec;
  }
}
