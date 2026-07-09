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
      if (!this.apiKey) {
        throw new Error('No OpenAI API key configured. Add your key in the "OpenAI API" tab.');
      }
      const openai = new OpenAI({
        apiKey: this.apiKey,
        dangerouslyAllowBrowser: true
      });
      let response;
      try {
        // `functions` is a deprecated (but still functional) Chat Completions
        // parameter; cast to `any` so the current SDK typings don't reject it.
        response = await openai.chat.completions.create({
          model: this.model,
          messages: messages,
          functions: functions,
          max_tokens: maxTokens,
          temperature: temperature
        } as any);
      } catch (err: any) {
        throw new Error(this.describeOpenAiError(err));
      }
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

  /**
   * Turn an OpenAI SDK error into a short, user-friendly message.
   * Distinguishes connection/network failures from HTTP status errors
   * (auth, rate limit, etc.) so the UI can show something actionable
   * instead of leaving a spinner running forever.
   */
  private describeOpenAiError(err: any): string {
    const status = err?.status;
    const name = err?.name;
    if (status === 401) {
      return 'OpenAI rejected the API key (401). Check the key in the "OpenAI API" tab.';
    }
    if (status === 429) {
      return 'OpenAI rate limit or quota exceeded (429). Try again later or check your plan.';
    }
    if (status === 404) {
      return `OpenAI could not find model "${this.model}" (404). Check the model id in the "OpenAI API" tab.`;
    }
    if (status && status >= 500) {
      return `OpenAI service error (${status}). Try again in a moment.`;
    }
    if (name === 'APIConnectionError' || name === 'APIConnectionTimeoutError' || !status) {
      return 'Could not reach OpenAI (connection error). Check your network and that requests to api.openai.com are not blocked.';
    }
    return err?.message ? `OpenAI error: ${err.message}` : 'Unexpected OpenAI error.';
  }

  getFromLocalStorage(key: string) {
    return this.storage.get(key);
  }
}
