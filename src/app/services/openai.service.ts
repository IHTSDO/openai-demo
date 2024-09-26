import { Inject, Injectable } from '@angular/core';
import { Configuration, OpenAIApi } from 'openai';
import { LOCAL_STORAGE, StorageService } from 'ngx-webstorage-service';
import { CacheService } from './cache.service';

@Injectable({
  providedIn: 'root'
})
export class OpenaiService {

  apiKey = '';
  model = 'gpt-4o-mini'; // Original 0301 - gpt-3.5-turbo-0613
  promptTokensPrice4k35 = 0.0015;
  completionTokensPrice4k35 = 0.002;
  promptTokensPrice16k35 = 0.003;
  completionTokensPrice16k35 = 0.004;
  disableCache = false;

  constructor(@Inject(LOCAL_STORAGE) private storage: StorageService, private cacheService: CacheService) { }

  getModel() {
    return this.model;
  }

  setModel(model: string) {
    this.model = model;
  }

  async completion(messages: any[], maxTokens: number, temperature: number, functions?: any[]): Promise<any>  {
    const params = {
      messages: messages,
      functions: functions,
      maxTokens: maxTokens,
      temperature: temperature
    }
    const cachedData = this.cacheService.getFromCache(params);
    if (cachedData && !this.disableCache) {
      // return cachedata as a promise
      console.log("API Cost: 0 USD (Cached)");
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
        functions: functions,
        max_tokens: maxTokens,
        temperature: temperature
      });
      this.cacheService.addToCache(params, result);
      if (result?.data?.usage) {
        const prompt_tokens = result?.data?.usage?.prompt_tokens;
        const completion_tokens = result?.data?.usage?.completion_tokens;
        const cost = (prompt_tokens / 1000 * this.promptTokensPrice16k35 + completion_tokens / 1000 * this.completionTokensPrice16k35).toFixed(4);
        console.log("API Cost: ", cost, "USD");
      }
      
      return new Promise((resolve, reject) => {
        resolve(result);
      });
    }
  }

  getFromLocalStorage(key: string) {
    return this.storage.get(key);
  }
}
