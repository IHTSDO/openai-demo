import { Inject, Injectable } from '@angular/core';
import { Configuration, OpenAIApi } from 'openai';
import { LOCAL_STORAGE, StorageService } from 'ngx-webstorage-service';
import { CacheService } from './cache.service';

@Injectable({
  providedIn: 'root'
})
export class OpenaiService {

  apiKey = '';
  model = 'gpt-3.5-turbo-0301';

  constructor(@Inject(LOCAL_STORAGE) private storage: StorageService, private cacheService: CacheService) { }

  getModel() {
    return this.model;
  }

  async completion(messages: any[], maxTokens: number, temperature: number): Promise<any>  {
    const params = {
      messages: messages,
      maxTokens: maxTokens,
      temperature: temperature
    }
    const cachedData = this.cacheService.getFromCache(params);
    if (cachedData) {
      // return cachedata as a promise
      return new Promise((resolve, reject) => {
        resolve(cachedData);
      });
    } else {
      if (!this.apiKey) {
        this.apiKey = this.storage.get('tempDataSct');
      }
      const configuration = new Configuration({
        apiKey: this.apiKey
      });
      const openai = new OpenAIApi(configuration);
      const result = await openai.createChatCompletion({
        model: this.model,
        messages: messages,
        max_tokens: maxTokens,
        temperature: temperature
      });
      this.cacheService.addToCache(params, result);
      return new Promise((resolve, reject) => {
        resolve(result);
      });
    }
  }

  getFromLocalStorage(key: string) {
    return this.storage.get(key);
  }
}
