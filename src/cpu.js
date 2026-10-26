import { Wllama } from '@wllama/wllama/esm/index.js';
import { checkModelStorage } from './phone-support.js';

// Hugging Face's CloudFront WAF returns 404 (without CORS headers) when Referer is *.workers.dev.
// Strip the Referer header on Hugging Face fetches so browser downloads succeed on all hosts.
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

export const CPU_MODELS = {
  'qwen2.5-0.5b-q4km-cpu': {
    id: 'qwen2.5-0.5b-q4km-cpu',
    label: 'Qwen 2.5 0.5B (Fast · 469 MB)',
    family: 'Qwen 2.5 0.5B',
    params: '0.49B',
    quant: 'Q4_K_M (GGUF)',
    backend: 'cpu',
    runtimeName: 'wllama (llama.cpp WASM CPU)',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    bytes: 491400032,
    mbLabel: '469 MB',
    recommendedPhone: true,
    disableThinking: false,
  },
  'qwen2.5-0.5b-q2k-cpu': {
    id: 'qwen2.5-0.5b-q2k-cpu',
    label: 'Qwen 2.5 0.5B Lite (Low-RAM · 396 MB)',
    family: 'Qwen 2.5 0.5B',
    params: '0.49B',
    quant: 'Q2_K (GGUF)',
    backend: 'cpu',
    runtimeName: 'wllama (llama.cpp WASM CPU)',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q2_k.gguf',
    bytes: 415182688,
    mbLabel: '396 MB',
    recommendedPhone: true,
    disableThinking: false,
  },
  'qwen3.5-0.8b-q4km-cpu': {
    id: 'qwen3.5-0.8b-q4km-cpu',
    label: 'Qwen 3.5 0.8B (508 MB)',
    family: 'Qwen 3.5 0.8B',
    params: '0.80B',
    quant: 'Q4_K_M (GGUF)',
    backend: 'cpu',
    runtimeName: 'wllama (llama.cpp WASM CPU)',
    url: 'https://huggingface.co/unsloth/Qwen3.5-0.8B-GGUF/resolve/6ab461498e2023f6e3c1baea90a8f0fe38ab64d0/Qwen3.5-0.8B-Q4_K_M.gguf',
    bytes: 532517120,
    mbLabel: '508 MB',
    recommendedPhone: true,
    disableThinking: true,
  },
  'qwen2.5-1.5b-q4km-cpu': {
    id: 'qwen2.5-1.5b-q4km-cpu',
    label: 'Qwen 2.5 1.5B (Desktop CPU · 1.06 GB)',
    family: 'Qwen 2.5 1.5B',
    params: '1.54B',
    quant: 'Q4_K_M (GGUF)',
    backend: 'cpu',
    runtimeName: 'wllama (llama.cpp WASM CPU)',
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    bytes: 1117320736,
    mbLabel: '1065 MB',
    recommendedPhone: false,
    disableThinking: false,
  },
};

export const DEFAULT_CPU_MODEL_ID = 'qwen2.5-0.5b-q4km-cpu';

function runtime() {
  const instance = new Wllama(
    { default: '/vendor/wllama.wasm' },
    {
      allowOffline: true,
      suppressNativeLog: true,
      logger: { debug() {}, log() {}, warn: console.warn, error: console.error },
    }
  );
  instance.setCompat(
    { wasm: '/vendor/wllama-compat.wasm', worker: '/vendor/wllama-compat.js' },
    'firefox_safari'
  );
  return instance;
}

export async function removePhoneModel(modelId) {
  const inst = runtime();
  const mgr = inst.cacheManager;
  try {
    if (modelId && CPU_MODELS[modelId]) {
      await mgr.delete(CPU_MODELS[modelId].url);
      return;
    }
    for (const spec of Object.values(CPU_MODELS)) {
      try {
        await mgr.delete(spec.url);
      } catch {}
    }
  } finally {
    void inst.exit().catch(() => {});
  }
}

export function createPhoneEngine(modelId = DEFAULT_CPU_MODEL_ID, { nCtx = 2048 } = {}) {
  const spec = CPU_MODELS[modelId] || CPU_MODELS[DEFAULT_CPU_MODEL_ID];
  let instance = null;
  let requestController = null;

  const create = async (request) => {
    const controller = new AbortController();
    requestController = controller;
    const { extra_body, response_format, ...options } = request;
    try {
      const result = await instance.createChatCompletion({
        ...options,
        cache_prompt: false,
        ...(spec.disableThinking ? { chat_template_kwargs: { enable_thinking: false } } : {}),
        abortSignal: controller.signal,
      });
      if (!request.stream) {
        if (requestController === controller) requestController = null;
        return result;
      }
      return (async function* () {
        try {
          yield* result;
        } finally {
          if (requestController === controller) requestController = null;
        }
      })();
    } catch (error) {
      if (requestController === controller) requestController = null;
      throw error;
    }
  };

  return {
    spec,
    chat: { completions: { create } },
    async load({ signal, onProgress, onPhase = () => {} }) {
      let model;
      let loadedFromCache = false;
      onPhase({ phase: 'storage', text: 'Checking browser OPFS cache…' });
      try {
        instance = runtime();
        model = (await instance.modelManager.getModels()).find((m) => m.url === spec.url);
        loadedFromCache = !!model;
        if (!model) await checkModelStorage({ signal });
      } catch (error) {
        if (signal?.aborted) throw signal.reason;
        const tagged = error instanceof Error ? error : new Error(error?.message || String(error));
        tagged.stage = 'storage';
        throw tagged;
      }
      if (signal?.aborted) throw signal.reason;
      if (!model) {
        onPhase({ phase: 'download', text: `Downloading ${spec.label}…` });
        model = await instance.modelManager.downloadModel(
          { url: spec.url },
          { signal, progressCallback: onProgress }
        );
      }
      if (signal?.aborted) throw signal.reason;
      onPhase({
        phase: 'loading',
        loadedFromCache,
        text: loadedFromCache
          ? `Reloading cached ${spec.family} from device storage…`
          : `Loading ${spec.family} into WASM memory…`,
      });
      await instance.loadModel(model, {
        n_gpu_layers: 0,
        n_threads: 1,
        n_ctx: nCtx,
        n_batch: 128,
        n_ubatch: 64,
        n_parallel: 1,
        warmup: false,
        ...(spec.disableThinking ? { default_template_kwargs: { enable_thinking: false } } : {}),
      });
      if (signal?.aborted) {
        await instance.exit();
        throw signal.reason;
      }
      return { loadedFromCache };
    },
    async resetChat() {},
    interruptGenerate() {
      requestController?.abort();
    },
    dispose() {
      requestController?.abort();
      void instance?.exit().catch(() => {});
    },
  };
}
