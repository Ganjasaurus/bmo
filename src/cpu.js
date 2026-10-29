import { Wllama } from '@wllama/wllama/esm/index.js';

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
  'lfm2.5-350m-qad-cpu': {
    id: 'lfm2.5-350m-qad-cpu',
    label: 'LiquidAI LFM2.5 350M Witty (209 MB · Best Wit, Lyrics & Jokes)',
    family: 'LFM2.5 350M',
    params: '0.35B',
    quant: 'QAD-Q4_0 (GGUF)',
    backend: 'cpu',
    runtimeName: 'wllama (LiquidAI Hybrid WASM)',
    url: 'https://huggingface.co/LiquidAI/LFM2.5-350M-GGUF/resolve/main/LFM2.5-350M-QAD-Q4_0.gguf',
    bytes: 219312832,
    mbLabel: '209 MB',
    recommendedPhone: true,
    disableThinking: false,
  },
  'lfm2.5-350m-heretic-cpu': {
    id: 'lfm2.5-350m-heretic-cpu',
    label: 'LFM2.5 350M Heretic (219 MB · Unfiltered Creative & Cheeky)',
    family: 'LFM2.5 Heretic',
    params: '0.35B',
    quant: 'Q4_K_M imatrix (GGUF)',
    backend: 'cpu',
    runtimeName: 'wllama (LiquidAI Hybrid WASM)',
    url: 'https://huggingface.co/FadedRedStar/LFM2.5-350M-heretic-imatrix-GGUF/resolve/main/LFM2.5-350M-heretic-Q4_K_M-imatrix.gguf',
    bytes: 229312512,
    mbLabel: '219 MB',
    recommendedPhone: true,
    disableThinking: false,
  },
  'smollm2-135m-q4km-cpu': {
    id: 'smollm2-135m-q4km-cpu',
    label: 'SmolLM2 135M Turbo (100 MB · Ultra-Tiny Instant English)',
    family: 'SmolLM2 135M',
    params: '0.135B',
    quant: 'Q4_K_M (GGUF)',
    backend: 'cpu',
    runtimeName: 'wllama (llama.cpp WASM CPU)',
    url: 'https://huggingface.co/unsloth/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-Q4_K_M.gguf',
    bytes: 105454144,
    mbLabel: '100 MB',
    recommendedPhone: true,
    disableThinking: false,
  },
  'smollm2-360m-q4km-cpu': {
    id: 'smollm2-360m-q4km-cpu',
    label: 'SmolLM2 360M Storyteller (258 MB · Fast Bedtime Stories)',
    family: 'SmolLM2 360M',
    params: '0.36B',
    quant: 'Q4_K_M (GGUF)',
    backend: 'cpu',
    runtimeName: 'wllama (llama.cpp WASM CPU)',
    url: 'https://huggingface.co/unsloth/SmolLM2-360M-Instruct-GGUF/resolve/main/SmolLM2-360M-Instruct-Q4_K_M.gguf',
    bytes: 270590560,
    mbLabel: '258 MB',
    recommendedPhone: true,
    disableThinking: false,
  },
  'dolphin3-0.5b-q4km-cpu': {
    id: 'dolphin3-0.5b-q4km-cpu',
    label: 'Dolphin 3.0 0.5B Persona (379 MB · Custom Roleplay Fine-Tune)',
    family: 'Dolphin 3.0 0.5B',
    params: '0.49B',
    quant: 'Q4_K_M (GGUF)',
    backend: 'cpu',
    runtimeName: 'wllama (llama.cpp WASM CPU)',
    url: 'https://huggingface.co/bartowski/Dolphin3.0-Qwen2.5-0.5B-GGUF/resolve/main/Dolphin3.0-Qwen2.5-0.5B-Q4_K_M.gguf',
    bytes: 397811008,
    mbLabel: '379 MB',
    recommendedPhone: true,
    disableThinking: false,
  },
  'smollm2-135m-q2k-cpu': {
    id: 'smollm2-135m-q2k-cpu',
    label: 'SmolLM2 135M Nano (84 MB · Featherweight Fallback)',
    family: 'SmolLM2 135M Nano',
    params: '0.135B',
    quant: 'Q2_K (GGUF)',
    backend: 'cpu',
    runtimeName: 'wllama (llama.cpp WASM CPU)',
    url: 'https://huggingface.co/unsloth/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-Q2_K.gguf',
    bytes: 88201792,
    mbLabel: '84 MB',
    recommendedPhone: true,
    disableThinking: false,
  },
};

export const DEFAULT_CPU_MODEL_ID = 'lfm2.5-350m-qad-cpu';

const BRAIN_DB_NAME = 'bmo-brain-cache-v2';
const BRAIN_STORE = 'models';

function openBrainDB() {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(BRAIN_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(BRAIN_STORE)) {
          db.createObjectStore(BRAIN_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function getCachedBrainBlob(key, expectedBytes) {
  const db = await openBrainDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(BRAIN_STORE, 'readonly');
      const req = tx.objectStore(BRAIN_STORE).get(key);
      req.onsuccess = () => {
        const val = req.result;
        if (!val) {
          resolve(null);
          return;
        }
        const blob = val instanceof Blob ? val : new Blob([val], { type: 'application/octet-stream' });
        if (expectedBytes && blob.size !== expectedBytes) {
          resolve(null);
          return;
        }
        resolve(blob);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function setCachedBrainBlob(key, blob) {
  const db = await openBrainDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(BRAIN_STORE, 'readwrite');
      tx.objectStore(BRAIN_STORE).put(blob, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function fetchRangePart(url, start, end, signal, onDelta) {
  const res = await fetch(url, {
    headers: { Range: `bytes=${start}-${end}` },
    referrerPolicy: 'no-referrer',
    signal,
  });
  if (res.status !== 206 && res.status !== 200) {
    throw new Error(`HTTP ${res.status} fetching model chunk`);
  }
  const expectedLen = end - start + 1;
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    onDelta(buf.byteLength);
    return res.status === 206 ? buf : buf.subarray(start, end + 1);
  }
  const reader = res.body.getReader();
  const out = new Uint8Array(expectedLen);
  let offset = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (offset + value.byteLength <= out.byteLength) {
      out.set(value, offset);
    }
    offset += value.byteLength;
    onDelta(value.byteLength);
  }
  return offset === expectedLen ? out : out.subarray(0, offset);
}

async function downloadBrainFast(spec, { signal, onProgress }) {
  const total = spec.bytes;
  const numStreams = 6;
  const partSize = Math.ceil(total / numStreams);
  let loaded = 0;
  let lastReport = 0;

  const report = (delta) => {
    loaded += delta;
    const now = Date.now();
    if (now - lastReport > 60 || loaded >= total) {
      lastReport = now;
      onProgress?.({ loaded: Math.min(loaded, total), total });
    }
  };

  try {
    const ranges = [];
    for (let i = 0; i < numStreams; i++) {
      const start = i * partSize;
      const end = Math.min(total - 1, (i + 1) * partSize - 1);
      if (start <= end) ranges.push({ start, end });
    }
    const parts = await Promise.all(
      ranges.map((r) => fetchRangePart(spec.url, r.start, r.end, signal, report))
    );
    const blob = new Blob(parts, { type: 'application/octet-stream' });
    if (blob.size === total) {
      void setCachedBrainBlob(spec.id, blob);
      return blob;
    }
  } catch (err) {
    if (signal?.aborted) throw err;
  }

  // Fallback to single stream if Range was blocked or size differed
  loaded = 0;
  const res = await fetch(spec.url, { referrerPolicy: 'no-referrer', signal });
  if (!res.ok) throw new Error(`Failed to download ${spec.label} (HTTP ${res.status})`);
  if (!res.body) {
    const buf = await res.arrayBuffer();
    onProgress?.({ loaded: buf.byteLength, total: total || buf.byteLength });
    const blob = new Blob([buf], { type: 'application/octet-stream' });
    void setCachedBrainBlob(spec.id, blob);
    return blob;
  }
  const reader = res.body.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    report(value.byteLength);
  }
  const blob = new Blob(chunks, { type: 'application/octet-stream' });
  void setCachedBrainBlob(spec.id, blob);
  return blob;
}

function runtime() {
  const origin = globalThis.location?.origin || '';
  const instance = new Wllama(
    { default: `${origin}/vendor/wllama.wasm` },
    {
      allowOffline: true,
      suppressNativeLog: true,
      logger: { debug() {}, log() {}, warn: console.warn, error: console.error },
    }
  );
  instance.setCompat(
    { wasm: `${origin}/vendor/wllama-compat.wasm`, worker: `${origin}/vendor/wllama-compat.js` },
    'safari'
  );
  return instance;
}

export async function removePhoneModel(modelId) {
  const db = await openBrainDB();
  if (db) {
    try {
      const tx = db.transaction(BRAIN_STORE, 'readwrite');
      if (modelId) {
        tx.objectStore(BRAIN_STORE).delete(modelId);
      } else {
        tx.objectStore(BRAIN_STORE).clear();
      }
    } catch {}
  }
}

export function createPhoneEngine(modelId = DEFAULT_CPU_MODEL_ID, { nCtx = 1024 } = {}) {
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
        cache_prompt: true,
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
      let loadedFromCache = false;
      onPhase({ phase: 'storage', text: `Checking cached ${spec.family}…` });
      if (signal?.aborted) throw signal.reason;

      let blob = await getCachedBrainBlob(spec.id, spec.bytes);
      if (blob) {
        loadedFromCache = true;
        onProgress?.({ loaded: blob.size, total: blob.size });
      } else {
        onPhase({ phase: 'download', text: `Downloading ${spec.label}…` });
        blob = await downloadBrainFast(spec, { signal, onProgress });
      }

      if (signal?.aborted) throw signal.reason;
      onPhase({
        phase: 'loading',
        loadedFromCache,
        text: loadedFromCache
          ? `Loading cached ${spec.family}…`
          : `Starting ${spec.family}…`,
      });

      instance = runtime();
      const modelFile = new File([blob], `${spec.id}.gguf`, { type: 'application/octet-stream' });
      const hw = globalThis.navigator?.hardwareConcurrency || 4;
      const nThreads = globalThis.crossOriginIsolated
        ? Math.max(2, Math.min(6, Math.floor(hw / 2)))
        : 1;
      await instance.loadModel([modelFile], {
        n_gpu_layers: 0,
        n_threads: nThreads,
        n_ctx: nCtx,
        n_batch: 256,
        n_ubatch: 128,
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
