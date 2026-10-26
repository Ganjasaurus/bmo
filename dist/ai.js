import { normalizeAIError, waitForAI, cleanOutput, verifyAIReady } from './ai-support.js?v=1';
import { describeSetupFailure } from './setup-support.js?v=1';
import { extractSentences } from './visemes.js?v=1';

export { normalizeAIError, cleanOutput };

export const MODEL_CATALOG = [
  {
    id: 'qwen2.5-0.5b-q4km-cpu',
    label: 'Qwen 2.5 0.5B (469 MB · Fast CPU/Phone)',
    shortLabel: 'Qwen 2.5 0.5B',
    params: '0.49B',
    quant: 'Q4_K_M GGUF',
    backend: 'cpu',
    runtime: 'wllama (llama.cpp WASM CPU)',
    sizeMB: 469,
    phoneReady: true,
  },
  {
    id: 'qwen2.5-0.5b-q2k-cpu',
    label: 'Qwen 2.5 0.5B Lite (396 MB · Low-RAM)',
    shortLabel: 'Qwen 0.5B Lite',
    params: '0.49B',
    quant: 'Q2_K GGUF',
    backend: 'cpu',
    runtime: 'wllama (llama.cpp WASM CPU)',
    sizeMB: 396,
    phoneReady: true,
  },
  {
    id: 'qwen3.5-0.8b-q4km-cpu',
    label: 'Qwen 3.5 0.8B (508 MB · CPU)',
    shortLabel: 'Qwen 3.5 0.8B',
    params: '0.80B',
    quant: 'Q4_K_M GGUF',
    backend: 'cpu',
    runtime: 'wllama (llama.cpp WASM CPU)',
    sizeMB: 508,
    phoneReady: true,
  },
  {
    id: 'qwen2.5-1.5b-q4km-cpu',
    label: 'Qwen 2.5 1.5B (1.06 GB · Deep CPU)',
    shortLabel: 'Qwen 2.5 1.5B',
    params: '1.54B',
    quant: 'Q4_K_M GGUF',
    backend: 'cpu',
    runtime: 'wllama (llama.cpp WASM CPU)',
    sizeMB: 1065,
    phoneReady: false,
  },
  {
    id: 'qwen3-0.6b-webgpu',
    label: 'Qwen 3 0.6B (WebGPU Accelerated)',
    shortLabel: 'Qwen 3 0.6B GPU',
    params: '0.60B',
    quant: 'q4f16_1 MLC',
    backend: 'webgpu',
    runtime: '@mlc-ai/web-llm (WebGPU)',
    sizeMB: 420,
    phoneReady: false,
    webllmSize: '0.6B',
  },
];

const PREF_KEY = 'bmo-local-ai-v1';

export const ai = {
  status: 'idle',
  phase: 'idle',
  text: 'Starting Qwen 0.5B…',
  progress: 0,
  modelId: 'qwen2.5-0.5b-q4km-cpu',
  modelSpec: MODEL_CATALOG[0],
  nCtx: 2048,
  engine: null,
  worker: null,
  error: null,
  busy: false,
  backend: 'cpu',
  diagnostic: null,
  recovery: null,
  failedPhase: null,
  telemetry: {
    generations: 0,
    lastTokensPerSec: 0,
    lastLatencyMs: 0,
    loadedFromCache: false,
  },
};

const listeners = new Set();
const jobs = new Set();
let epoch = 0;
let queue = Promise.resolve();
let session = new AbortController();
let activeJob = null;
let loadPromise = null;

export function subscribeAI(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function update(patch) {
  Object.assign(ai, patch);
  for (const fn of listeners) {
    try {
      fn(ai);
    } catch (e) {
      console.error('Could not refresh AI status', e);
    }
  }
}

function abortError(message) {
  return new DOMException(message, 'AbortError');
}

function resetSession(reason) {
  epoch++;
  session.abort(reason);
  for (const job of jobs) job.controller.abort(reason);
  jobs.clear();
  activeJob = null;
  queue = Promise.resolve();
  ai.worker?.terminate();
  ai.worker = null;
  ai.engine = null;
  loadPromise = null;
  session = new AbortController();
}

function failSession(error, setup = false) {
  const err = normalizeAIError(error);
  const failure = setup
    ? describeSetupFailure(err, ai.phase)
    : { message: err.message, recovery: null, phase: ai.phase };
  resetSession(err);
  update({
    status: 'error',
    phase: 'error',
    busy: false,
    error: failure.message,
    text: failure.message,
    progress: 0,
    recovery: failure.recovery,
    failedPhase: failure.phase,
  });
}

function watchWorker(worker, run) {
  const failed = (event) => {
    if (run !== epoch) return;
    event.preventDefault?.();
    failSession(new Error(event.message || 'The AI worker stopped. Click Reload to resume.'));
  };
  worker.addEventListener('error', failed);
  worker.addEventListener('messageerror', failed);
}

export function getSavedPreferences() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return null;
    const spec = MODEL_CATALOG.find((m) => m.id === raw.modelId);
    if (!spec) return null;
    return {
      modelId: spec.id,
      nCtx: [1024, 2048, 4096].includes(Number(raw.nCtx)) ? Number(raw.nCtx) : 2048,
      autoLoad: raw.autoLoad !== false,
    };
  } catch {
    return null;
  }
}

export function savePreferences(prefs) {
  try {
    const current = getSavedPreferences() || { modelId: ai.modelId, nCtx: ai.nCtx, autoLoad: true };
    localStorage.setItem(PREF_KEY, JSON.stringify({ ...current, ...prefs }));
  } catch {}
}

export function enableAI(modelId = ai.modelId, { nCtx = ai.nCtx } = {}) {
  const spec = MODEL_CATALOG.find((m) => m.id === modelId) || MODEL_CATALOG[0];
  if (ai.status === 'ready' && ai.modelId === spec.id && ai.nCtx === nCtx) {
    return Promise.resolve(true);
  }
  if (loadPromise && ai.modelId === spec.id && ai.nCtx === nCtx) {
    return loadPromise;
  }

  resetSession(abortError('Switching AI model session.'));
  const run = epoch;
  const signal = session.signal;
  const backend = spec.backend;

  update({
    status: 'loading',
    phase: 'device',
    modelId: spec.id,
    modelSpec: spec,
    nCtx,
    backend,
    text: `Preparing ${spec.shortLabel}…`,
    progress: 0.02,
    error: null,
    busy: false,
    diagnostic: null,
    recovery: null,
    failedPhase: null,
  });

  const loading = (async () => {
    try {
      if (!globalThis.isSecureContext) {
        throw new Error('Local AI needs HTTPS or localhost.');
      }
      let engine;
      let loadedFromCache = false;

      if (backend === 'cpu') {
        if (!globalThis.WebAssembly || !globalThis.Worker) {
          throw new Error('WebAssembly or Web Workers are unavailable in this browser.');
        }
        const { createPhoneEngine } = await waitForAI(import('./vendor/cpu.js?v=1'), {
          signal,
          timeoutMs: 45000,
          message: 'The wllama CPU runtime could not load.',
        });
        if (signal.aborted) throw signal.reason;
        engine = createPhoneEngine(spec.id, { nCtx });
        ai.worker = { terminate: () => engine.dispose() };
        ai.engine = engine;

        const loadInfo = await waitForAI(
          engine.load({
            signal,
            onPhase: ({ phase, text, loadedFromCache: cached }) => {
              if (cached != null) loadedFromCache = cached;
              if (run === epoch) update({ phase, text, ...(phase === 'loading' ? { progress: 0.9 } : {}) });
            },
            onProgress: ({ loaded, total }) => {
              if (run !== epoch) return;
              const expectedTotal = total || spec.sizeMB * 1048576;
              const fraction = expectedTotal ? loaded / expectedTotal : 0;
              update({
                phase: 'download',
                progress: Math.min(0.9, fraction * 0.9),
                text:
                  fraction >= 1
                    ? `Finishing ${spec.shortLabel}…`
                    : `Downloading ${spec.shortLabel} · ${Math.round(loaded / 1000000)} / ${Math.round(expectedTotal / 1000000)} MB (${Math.round(fraction * 100)}%)`,
              });
            },
          }),
          {
            signal,
            timeoutMs: 600000,
            message: 'Model download timed out. Check connection or try Qwen 0.5B Lite.',
          }
        );
        if (loadInfo?.loadedFromCache) loadedFromCache = true;
      } else {
        if (!navigator.gpu) {
          throw new Error('WebGPU is unavailable in this browser. Switch to Qwen 2.5 0.5B (CPU)!');
        }
        const adapter = await waitForAI(navigator.gpu.requestAdapter(), {
          signal,
          timeoutMs: 15000,
          message: 'WebGPU detection timed out. Switch to Qwen 2.5 0.5B (CPU).',
        });
        if (!adapter) {
          throw new Error('No compatible WebGPU adapter found. Select Qwen 2.5 0.5B (CPU).');
        }
        const precision = adapter.features.has('shader-f16') ? '16' : '32';
        const mlcModelId = `Qwen3-${spec.webllmSize}-q4f${precision}_1-MLC`;
        const { CreateWebWorkerMLCEngine } = await waitForAI(import('./vendor/engine.js?v=1'), {
          signal,
          timeoutMs: 45000,
          message: 'WebLLM engine failed to load.',
        });
        if (signal.aborted) throw signal.reason;
        const worker = new Worker(new URL('./vendor/worker.js?v=1', import.meta.url), { type: 'module' });
        ai.worker = worker;
        watchWorker(worker, run);
        engine = await waitForAI(
          CreateWebWorkerMLCEngine(
            worker,
            mlcModelId,
            {
              initProgressCallback: (p) => {
                if (run !== epoch) return;
                update({
                  progress: Math.min(0.9, Math.max(0.04, p.progress) * 0.9),
                  phase: /cache|loading/i.test(p.text) ? 'loading' : 'download',
                  text: p.text,
                });
              },
            },
            { context_window_size: nCtx }
          ),
          {
            signal,
            timeoutMs: 600000,
            message: 'WebGPU model loading timed out. Switch to Qwen 2.5 0.5B (CPU).',
          }
        );
      }

      if (run !== epoch) return false;
      ai.engine = engine;
      update({ phase: 'verifying', progress: 0.95, text: `Warming up ${spec.shortLabel}…` });

      await verifyAIReady(engine, {
        signal,
        backend,
        onDiagnostic: (diagnostic) => {
          if (run === epoch) ai.diagnostic = { backend, ...diagnostic };
        },
      });
      if (run !== epoch) return false;

      savePreferences({ modelId: spec.id, nCtx, autoLoad: true });

      update({
        status: 'ready',
        phase: 'ready',
        progress: 1,
        text: `${spec.shortLabel} Ready`,
        error: null,
        telemetry: {
          ...ai.telemetry,
          loadedFromCache,
        },
      });
      return true;
    } catch (error) {
      if (run === epoch) failSession(error, true);
      return false;
    } finally {
      if (run === epoch) loadPromise = null;
    }
  })();

  loadPromise = loading;
  loading.finally(() => {
    if (loadPromise === loading) loadPromise = null;
  });
  return loading;
}

export function autoBootAI() {
  const pref = getSavedPreferences();
  const targetModelId = pref?.modelId || 'qwen2.5-0.5b-q4km-cpu';
  const targetCtx = pref?.nCtx || 2048;
  return enableAI(targetModelId, { nCtx: targetCtx });
}

export function complete(
  messages,
  {
    temperature = 0.7,
    max_tokens = 120,
    onToken,
    onSentence,
    firstTokenTimeoutMs = ai.backend === 'cpu' ? 95000 : 45000,
    tokenTimeoutMs = 20000,
    totalTimeoutMs = 150000,
  } = {}
) {
  const controller = new AbortController();
  const run = epoch;
  const job = { controller, stopping: false };
  jobs.add(job);

  const task = async () => {
    if (controller.signal.aborted) throw controller.signal.reason;
    if (run !== epoch || ai.status !== 'ready' || !ai.engine) {
      throw new Error('Local Qwen model is not loaded yet.');
    }
    activeJob = job;
    update({ busy: true });

    const engine = ai.engine;
    const started = Date.now();
    let rawOutput = '';
    let sentenceBuffer = '';
    let first = true;
    let tokenCount = 0;

    const bounded = (promise) =>
      waitForAI(promise, {
        signal: controller.signal,
        timeoutMs: Math.max(
          1,
          Math.min(first ? firstTokenTimeoutMs : tokenTimeoutMs, totalTimeoutMs - (Date.now() - started))
        ),
        message: first ? 'Qwen took too long to start replying.' : 'Qwen generation timed out.',
      });

    try {
      const response = await bounded(
        engine.chat.completions.create({
          messages,
          temperature,
          max_tokens,
          stream: true,
          extra_body: { enable_thinking: false },
        })
      );
      const iterator = response[Symbol.asyncIterator]();
      while (true) {
        const { value: chunk, done } = await bounded(iterator.next());
        if (done) break;
        const delta = chunk?.choices?.[0]?.delta?.content || '';
        if (delta) {
          rawOutput += delta;
          tokenCount++;
          first = false;
          const cleaned = cleanOutput(rawOutput);
          onToken?.(cleaned, delta);

          // Only accumulate into sentenceBuffer once outside <think> tags
          if (!/<think>(?![\s\S]*<\/think>)/i.test(rawOutput)) {
            sentenceBuffer += delta.replace(/<\/?think>/gi, '');
            const extracted = extractSentences(sentenceBuffer);
            sentenceBuffer = extracted.buffer;
            for (const s of extracted.sentences) {
              const cleanSentence = cleanOutput(s);
              if (cleanSentence) onSentence?.(cleanSentence);
            }
          }
        }
      }
      if (job.stopping) {
        const error = abortError('Generation stopped.');
        error.partial = cleanOutput(rawOutput);
        throw error;
      }
      const trailing = cleanOutput(sentenceBuffer);
      if (trailing) {
        onSentence?.(trailing);
      }
      const finalReply = cleanOutput(rawOutput).trim();
      if (!finalReply) throw new Error('Model returned an empty reply.');

      const elapsedSec = Math.max(0.1, (Date.now() - started) / 1000);
      const estOutTokens = Math.max(tokenCount, Math.round(finalReply.length / 4));
      update({
        telemetry: {
          ...ai.telemetry,
          generations: ai.telemetry.generations + 1,
          lastTokensPerSec: Number((estOutTokens / elapsedSec).toFixed(1)),
          lastLatencyMs: Date.now() - started,
        },
      });
      return finalReply;
    } catch (error) {
      const err = normalizeAIError(error);
      if (!err.partial) err.partial = cleanOutput(rawOutput);
      throw err;
    } finally {
      jobs.delete(job);
      if (activeJob === job) {
        activeJob = null;
        update({ busy: false });
      }
    }
  };

  const pending = queue.then(task, task);
  const result = waitForAI(pending, { signal: controller.signal, timeoutMs: 0 }).finally(() => jobs.delete(job));
  queue = pending.catch(() => {});
  return result;
}

export function stopGeneration() {
  const job = activeJob;
  if (!job) return;
  job.stopping = true;
  try {
    ai.engine?.interruptGenerate();
  } catch {}
}
