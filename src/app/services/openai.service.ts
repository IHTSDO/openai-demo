import { Inject, Injectable } from '@angular/core';
import OpenAI from 'openai';
import { LOCAL_STORAGE, StorageService } from 'ngx-webstorage-service';
import { CacheService } from './cache.service';

@Injectable({
  providedIn: 'root'
})
export class OpenaiService {

  apiKey = '';
  // Current model. The GPT-5 family does NOT accept `temperature` and requires
  // `max_completion_tokens` instead of `max_tokens` — the calls below already
  // comply, so every model in `models` works with the same code.
  model = 'gpt-5-mini';
  // USD per 1M tokens for the current `model`: input / output. Updated by
  // setModel() from the catalog below.
  promptCostPer1M = 0.25;
  completionCostPer1M = 2.00;
  disableCache = false;

  /**
   * Selectable models — all use the same Chat Completions API + Structured
   * Outputs. `price`/`speed` are rough guides for the UI; USD-per-1M costs are
   * used for the cost estimate. Verify IDs/prices against the OpenAI pricing
   * page, as the lineup changes.
   */
  readonly models = [
    { id: 'gpt-5-nano',    label: 'GPT-5 nano',    promptCostPer1M: 0.05,  completionCostPer1M: 0.40,   price: '$',     speed: 'Fast' },
    { id: 'gpt-5.4-nano',  label: 'GPT-5.4 nano',  promptCostPer1M: 0.20,  completionCostPer1M: 1.25,   price: '$',     speed: 'Fast' },
    { id: 'gpt-5-mini',    label: 'GPT-5 mini',    promptCostPer1M: 0.25,  completionCostPer1M: 2.00,   price: '$',     speed: 'Fast' },
    { id: 'gpt-5.6-luna',  label: 'GPT-5.6 Luna',  promptCostPer1M: 1.00,  completionCostPer1M: 6.00,   price: '$$',    speed: 'Balanced' },
    { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', promptCostPer1M: 2.50,  completionCostPer1M: 15.00,  price: '$$$',   speed: 'Balanced' },
    { id: 'gpt-5.6-sol',   label: 'GPT-5.6 Sol',   promptCostPer1M: 5.00,  completionCostPer1M: 30.00,  price: '$$$$',  speed: 'Deep' },
    { id: 'gpt-5.5-pro',   label: 'GPT-5.5 Pro',   promptCostPer1M: 30.00, completionCostPer1M: 180.00, price: '$$$$$', speed: 'Deep' },
  ];

  constructor(@Inject(LOCAL_STORAGE) private storage: StorageService, private cacheService: CacheService) {
    const saved = this.storage.get('sctModel');
    if (saved && this.models.some(m => m.id === saved)) {
      this.setModel(saved);
    }
  }

  getModel() {
    return this.model;
  }

  /** Switch the active model and update the cost rates + persist the choice. */
  setModel(id: string) {
    this.model = id;
    const m = this.models.find(x => x.id === id);
    if (m) {
      this.promptCostPer1M = m.promptCostPer1M;
      this.completionCostPer1M = m.completionCostPer1M;
    }
    this.storage.set('sctModel', id);
  }

  /** Estimated USD cost for a usage object, formatted to 4 decimals. */
  private computeCost(usage: any): string {
    const prompt = usage?.prompt_tokens ?? 0;
    const completion = usage?.completion_tokens ?? 0;
    return (prompt / 1000000 * this.promptCostPer1M + completion / 1000000 * this.completionCostPer1M).toFixed(4);
  }

  private resolveApiKey(): string {
    if (!this.apiKey) {
      this.apiKey = this.storage.get('tempDataSct');
    }
    if (!this.apiKey) {
      throw new Error('No OpenAI API key configured. Add your key in the "OpenAI API" tab.');
    }
    return this.apiKey;
  }

  // `temperature` is accepted for call-site compatibility but ignored: gpt-5-mini
  // rejects it. Plain text completion used by most tabs.
  async completion(messages: any[], maxTokens: number, temperature?: number): Promise<any>  {
    const params = { kind: 'completion', model: this.model, messages, maxTokens };
    const cachedData = this.cacheService.getFromCache(params);
    if (cachedData && !this.disableCache) {
      console.log("API Cost: 0 USD (Cached)");
      return cachedData;
    }
    const apiKey = this.resolveApiKey();
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    let response;
    try {
      response = await openai.chat.completions.create({
        model: this.model,
        messages: messages,
        max_completion_tokens: maxTokens
      } as any);
    } catch (err: any) {
      throw new Error(this.describeOpenAiError(err));
    }
    // Preserve the `{ data: ... }` response shape the components expect.
    const result = { data: response };
    this.cacheService.addToCache(params, result);
    if (response?.usage) {
      console.log("API Cost: ", this.computeCost(response.usage), "USD");
    }
    return result;
  }

  /**
   * Modern structured-output call. Uses Chat Completions with
   * `response_format: json_schema` (strict), so the model is forced to return
   * JSON matching `schema`. Targets the GPT-5 family, which does NOT accept
   * `temperature` and requires `max_completion_tokens` instead of `max_tokens`.
   *
   * Returns { parsed, usage, model, cost } where `parsed` is the validated object.
   * Results are cached like completion() to keep repeat runs free.
   */
  async extract(
    messages: any[],
    schema: { name: string; schema: any },
    options?: { maxCompletionTokens?: number }
  ): Promise<{ parsed: any; usage: any; model: string; cost: string; cached: boolean }> {
    const model = this.model;
    const maxCompletionTokens = options?.maxCompletionTokens ?? 10000;

    const cacheParams = { kind: 'extract', model, schema, messages, maxCompletionTokens };
    const cached = this.cacheService.getFromCache(cacheParams);
    if (cached && !this.disableCache) {
      console.log('API Cost: 0 USD (Cached)');
      return { ...cached, cached: true };
    }

    const apiKey = this.resolveApiKey();
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });

    let response: any;
    try {
      response = await openai.chat.completions.create({
        model: model,
        messages: messages,
        max_completion_tokens: maxCompletionTokens,
        response_format: {
          type: 'json_schema',
          json_schema: { name: schema.name, strict: true, schema: schema.schema }
        }
      } as any);
    } catch (err: any) {
      throw new Error(this.describeOpenAiError(err));
    }

    const choice = response?.choices?.[0]?.message;
    if (choice?.refusal) {
      throw new Error('The model refused to complete the request: ' + choice.refusal);
    }
    let parsed: any;
    try {
      parsed = JSON.parse(choice?.content ?? 'null');
    } catch {
      throw new Error('OpenAI returned malformed JSON for the extraction.');
    }

    const cost = this.computeCost(response?.usage);
    const result = { parsed, usage: response?.usage, model, cost };
    this.cacheService.addToCache(cacheParams, result);
    if (response?.usage) {
      console.log('API Cost: ', cost, 'USD');
    }
    return { ...result, cached: false };
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
      return `OpenAI could not find model "${this.model}" (404).`;
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
