import { Component, OnInit, InjectionToken, Inject, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { LOCAL_STORAGE, StorageService } from 'ngx-webstorage-service';
import { CacheService } from '../services/cache.service';
import { OpenaiService } from '../services/openai.service';
import { MatTabGroup } from '@angular/material/tabs';
import { MatDialog } from '@angular/material/dialog';
import { CookieService } from 'ngx-cookie-service';
import { AiWarningDialogComponent } from '../ai-warning-dialog/ai-warning-dialog.component';

@Component({
    selector: 'app-openai-test',
    templateUrl: './openai-test.component.html',
    styleUrls: ['./openai-test.component.css'],
    standalone: false
})
export class OpenaiTestComponent implements OnInit, OnChanges {
  @ViewChild('mainTabGroup') tabGroup!: MatTabGroup;

  result = "";
  storageKey = "tempDataSct";
  apiKey: string = "";
  apiKeyInInput: string = ""
  model = "";
  videoId = '-9Ro_Sa_5g8';

  constructor(@Inject(LOCAL_STORAGE) private storage: StorageService,
              private cacheService: CacheService, private openaiService: OpenaiService,
              public dialog: MatDialog, private cookieService: CookieService) { }

  ngOnInit(): void {
    this.model = this.openaiService.getModel();
    this.apiKey = this.storage.get(this.storageKey)
    // runb this check aftwe 1 second to allow the tab group to be initialized
    setTimeout(() => {
      if (!this.apiKey) {
        // No key yet → jump to the "OpenAI API" tab (last one) so the user can enter it.
        this.tabGroup.selectedIndex = 7;
      }
    }, 500);
    // Only show the AI warning dialog if it hasn't already been accepted,
    // so it doesn't flash open-then-close for returning users.
    if (this.cookieService.get('aiWarningAccepted') !== 'true') {
      this.dialog.open(AiWarningDialogComponent);
    }
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

}
