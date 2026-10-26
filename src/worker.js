import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

const originalFetch = globalThis.fetch?.bind(globalThis);
if (originalFetch && !globalThis.__hfReferrerPatched) {
  globalThis.__hfReferrerPatched = true;
  globalThis.fetch = (input, init = {}) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (/huggingface\.co|hf\.co/i.test(url)) {
      return originalFetch(input, { ...init, referrerPolicy: 'no-referrer' });
    }
    return originalFetch(input, init);
  };
}

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (event) => handler.onmessage(event);
