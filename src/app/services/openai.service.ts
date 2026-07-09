import { Inject, Injectable } from '@angular/core';
import OpenAI from 'openai';
import { LOCAL_STORAGE, StorageService } from 'ngx-webstorage-service';
import { CacheService } from './cache.service';

@Injectable({
  providedIn: 'root'
})
export class OpenaiService {

  apiKey = '';
  model = 'gpt-4o-mini'; // Original 0301 - gpt-3.5-turbo-0613
  modelCost = 0.15;
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
      // return cacheddata as a promise
      console.log("API Cost: 0 USD (Cached)");
      return cachedData;
    } else {
      if (!this.apiKey) {
        this.apiKey = this.storage.get('tempDataSct');
      }
      const openai = new OpenAI({
        apiKey: this.apiKey,
        dangerouslyAllowBrowser: true
      });
      // `functions` is a deprecated (but still functional) Chat Completions
      // parameter; cast to `any` so the current SDK typings don't reject it.
      const response = await openai.chat.completions.create({
        model: this.model,
        messages: messages,
        functions: functions,
        max_tokens: maxTokens,
        temperature: temperature
      } as any);
      // Preserve the `{ data: ... }` response shape the components expect.
      const result = { data: response };
      this.cacheService.addToCache(params, result);
      if (response?.usage) {
        const prompt_tokens = response.usage.prompt_tokens;
        const completion_tokens = response.usage.completion_tokens;
        const cost = (prompt_tokens / 1000000 * this.modelCost + completion_tokens / 1000000 * this.modelCost).toFixed(4);
        console.log("API Cost: ", cost, "USD");
      }

      return result;
    }
  }

  getFromLocalStorage(key: string) {
    return this.storage.get(key);
  }
}
