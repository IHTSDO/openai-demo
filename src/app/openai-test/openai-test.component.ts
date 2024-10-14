import { Component, OnInit, InjectionToken, Inject, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { Configuration, OpenAIApi } from "openai";
import { LOCAL_STORAGE, StorageService } from 'ngx-webstorage-service';
import { CacheService } from '../services/cache.service';
import { OpenaiService } from '../services/openai.service';
import { MatTabGroup } from '@angular/material/tabs';
import { MatDialog } from '@angular/material/dialog';
import { AiWarningDialogComponent } from '../ai-warning-dialog/ai-warning-dialog.component';

@Component({
  selector: 'app-openai-test',
  templateUrl: './openai-test.component.html',
  styleUrls: ['./openai-test.component.css']
})
export class OpenaiTestComponent implements OnInit, OnChanges {
  @ViewChild('mainTabGroup') tabGroup!: MatTabGroup;

  result = "";
  storageKey = "tempDataSct";
  apiKey: string = "";
  apiKeyInInput: string = ""
  apiModel = "";
  videoId = '-9Ro_Sa_5g8';

  constructor(@Inject(LOCAL_STORAGE) private storage: StorageService,
              private cacheService: CacheService, private openaiService: OpenaiService,
              public dialog: MatDialog) { }

  ngOnInit(): void {
    this.apiModel = this.openaiService.getModel();
    this.apiKey = this.storage.get(this.storageKey)
    // runb this check aftwe 1 second to allow the tab group to be initialized
    setTimeout(() => {
      if (!this.apiKey) {
        this.tabGroup.selectedIndex = 7;
      }
    }, 500);
    const dialogRef = this.dialog.open(AiWarningDialogComponent);
    dialogRef.afterClosed().subscribe(result => {
      // console.log(`Dialog result: ${result}`);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log(changes);
  }

  clearCache() {
    this.cacheService.clearCache();
  }

  removeFromLocalStorage(key: string) {
    this.storage.remove(key);
    this.apiKey = "";
  }

  saveToLocalStorage(key: string, value: any) {
    this.storage.set(key, value);
    this.apiKey = value;
  }

  getFromLocalStorage(key: string) {
    return this.storage.get(key);
  }

  onApiModelChange(newModel: string) {
    // Add logic here to handle the change in apiModel
    this.openaiService.setModel(newModel);
  }

}
