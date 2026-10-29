import { normalizeAIError, waitForAI, cleanOutput, verifyAIReady } from './ai-support.js?v=12';
import { describeSetupFailure } from './setup-support.js?v=12';
import { extractSentences } from './visemes.js?v=12';

export { normalizeAIError, cleanOutput };

export const MODEL_CATALOG = [
  {
    id: 'lfm2.5-350m-qad-cpu',
    label: 'LiquidAI LFM2.5 350M Witty (209 MB · Best Wit, Lyrics & Jokes)',
    shortLabel: 'LFM2.5 350M Witty',
    params: '0.35B',
    quant: 'QAD-Q4_0 GGUF',
    backend: 'cpu',
    runtime: 'wllama (LiquidAI Hybrid WASM)',
    sizeMB: 209,
    phoneReady: true,
  },
  {
    id: 'lfm2.5-350m-heretic-cpu',
    label: 'LFM2.5 350M Heretic (219 MB · Unfiltered Creative & Cheeky)',
    shortLabel: 'LFM2.5 Heretic',
    params: '0.35B',
    quant: 'Q4_K_M imatrix GGUF',
    backend: 'cpu',
    runtime: 'wllama (LiquidAI Hybrid WASM)',
    sizeMB: 219,
    phoneReady: true,
  },
  {
    id: 'smollm2-135m-q4km-cpu',
    label: 'SmolLM2 135M Turbo (100 MB · Ultra-Tiny Instant English)',
    shortLabel: 'SmolLM2 135M',
    params: '0.135B',
    quant: 'Q4_K_M GGUF',
    backend: 'cpu',
    runtime: 'wllama (llama.cpp WASM CPU)',
    sizeMB: 100,
    phoneReady: true,
  },
  {
    id: 'smollm2-360m-q4km-cpu',
    label: 'SmolLM2 360M Storyteller (258 MB · Fast Bedtime Stories)',
    shortLabel: 'SmolLM2 360M',
    params: '0.36B',
    quant: 'Q4_K_M GGUF',
    backend: 'cpu',
    runtime: 'wllama (llama.cpp WASM CPU)',
    sizeMB: 258,
    phoneReady: true,
  },
  {
    id: 'dolphin3-0.5b-q4km-cpu',
    label: 'Dolphin 3.0 0.5B Persona (379 MB · Custom Roleplay Fine-Tune)',
    shortLabel: 'Dolphin 3.0 0.5B',
    params: '0.49B',
    quant: 'Q4_K_M GGUF',
    backend: 'cpu',
    runtime: 'wllama (llama.cpp WASM CPU)',
    sizeMB: 379,
    phoneReady: true,
  },
  {
    id: 'smollm2-135m-q2k-cpu',
    label: 'SmolLM2 135M Nano (84 MB · Featherweight Fallback)',
    shortLabel: 'SmolLM2 Nano',
    params: '0.135B',
    quant: 'Q2_K GGUF',
    backend: 'cpu',
    runtime: 'wllama (llama.cpp WASM CPU)',
    sizeMB: 84,
    phoneReady: true,
  },
  {
    id: 'smollm2-360m-webgpu',
    label: 'SmolLM2 360M GPU (190 MB · Instant WebGPU Speed)',
    shortLabel: 'SmolLM2 360M GPU',
    params: '0.36B',
    quant: 'q4f16_1 MLC',
    backend: 'webgpu',
    runtime: '@mlc-ai/web-llm (WebGPU)',
    sizeMB: 190,
    phoneReady: false,
    mlcId16: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
    mlcId32: 'SmolLM2-360M-Instruct-q4f32_1-MLC',
  },
  {
    id: 'qwen3-0.6b-webgpu',
    label: 'Qwen 3 0.6B GPU (380 MB · WebGPU Accelerated)',
    shortLabel: 'Qwen 3 0.6B GPU',
    params: '0.60B',
    quant: 'q4f16_1 MLC',
    backend: 'webgpu',
    runtime: '@mlc-ai/web-llm (WebGPU)',
    sizeMB: 380,
    phoneReady: false,
    webllmSize: '0.6B',
    mlcId16: 'Qwen3-0.6B-q4f16_1-MLC',
    mlcId32: 'Qwen3-0.6B-q4f32_1-MLC',
  },
];

const PREF_KEY = 'bmo-local-ai-v3';

export const ai = {
  status: 'idle',
  phase: 'idle',
  text: 'Starting LFM2.5 350M Witty…',
  progress: 0,
  modelId: 'lfm2.5-350m-qad-cpu',
  modelSpec: MODEL_CATALOG[0],
  nCtx: 1024,
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
      nCtx: [1024, 2048, 4096].includes(Number(raw.nCtx)) ? Number(raw.nCtx) : 1024,
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
  let activeSpec = spec;
  let backend = activeSpec.backend;

  update({
    status: 'loading',
    phase: 'device',
    modelId: activeSpec.id,
    modelSpec: activeSpec,
    nCtx,
    backend,
    text: `Preparing ${activeSpec.shortLabel}…`,
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
      let adapter = null;

      if (backend === 'webgpu') {
        if (navigator.gpu) {
          try {
            adapter = await waitForAI(navigator.gpu.requestAdapter(), {
              signal,
              timeoutMs: 15000,
              message: 'WebGPU detection timed out. Switch to Qwen 2.5 0.5B (CPU).',
            });
          } catch {
            adapter = null;
          }
        }
        if (!adapter) {
          activeSpec = MODEL_CATALOG[0];
          backend = activeSpec.backend;
          update({
            modelId: activeSpec.id,
            modelSpec: activeSpec,
            backend,
            phase: 'device',
            text: `WebGPU unavailable — falling back to ${activeSpec.shortLabel} (CPU)…`,
          });
        }
      }

      if (backend === 'cpu') {
        if (!globalThis.WebAssembly || !globalThis.Worker) {
          throw new Error('WebAssembly or Web Workers are unavailable in this browser.');
        }
        const { createPhoneEngine } = await waitForAI(import('./vendor/cpu.js?v=12'), {
          signal,
          timeoutMs: 45000,
          message: 'The wllama CPU runtime could not load.',
        });
        if (signal.aborted) throw signal.reason;
        engine = createPhoneEngine(activeSpec.id, { nCtx });
        ai.worker = { terminate: () => engine.dispose() };
        ai.engine = engine;

        const loadInfo = await waitForAI(
          engine.load({
            signal,
            onPhase: ({ phase, text, loadedFromCache: cached }) => {
              if (cached != null) loadedFromCache = cached;
              if (run === epoch) update({ phase, text, ...(phase === 'loading' ? { progress: 0.92 } : {}) });
            },
            onProgress: ({ loaded, total }) => {
              if (run !== epoch) return;
              const expectedTotal = total || activeSpec.sizeMB * 1048576;
              const fraction = expectedTotal ? loaded / expectedTotal : 0;
              update({
                phase: 'download',
                progress: Math.min(0.9, fraction * 0.9),
                text:
                  fraction >= 1
                    ? `Finishing ${activeSpec.shortLabel}…`
                    : `Downloading ${activeSpec.shortLabel} · ${Math.round(loaded / 1000000)} / ${Math.round(expectedTotal / 1000000)} MB (${Math.round(fraction * 100)}%)`,
              });
            },
          }),
          {
            signal,
            timeoutMs: 300000,
            message: 'Model download timed out. Check connection or try SmolLM2 Nano.',
          }
        );
        if (loadInfo?.loadedFromCache) loadedFromCache = true;
      } else {
        const hasF16 = adapter.features.has('shader-f16');
        const mlcModelId = hasF16
          ? activeSpec.mlcId16 || `Qwen3-${activeSpec.webllmSize}-q4f16_1-MLC`
          : activeSpec.mlcId32 || `Qwen3-${activeSpec.webllmSize}-q4f32_1-MLC`;
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
            message: 'WebGPU model loading timed out. Switch to SmolLM2 135M (CPU).',
          }
        );
      }

      if (run !== epoch) return false;
      ai.engine = engine;

      if (backend === 'webgpu') {
        update({ phase: 'verifying', progress: 0.95, text: `Warming up ${activeSpec.shortLabel}…` });
        await verifyAIReady(engine, {
          signal,
          backend,
          onDiagnostic: (diagnostic) => {
            if (run === epoch) ai.diagnostic = { backend, ...diagnostic };
          },
        });
        if (run !== epoch) return false;
      } else {
        ai.diagnostic = { backend: 'cpu', attempt: 1, finishReason: 'loaded', warmupMs: 0 };
      }

      savePreferences({ modelId: activeSpec.id, nCtx, autoLoad: true });

      update({
        status: 'ready',
        phase: 'ready',
        progress: 1,
        text: `${activeSpec.shortLabel} Ready`,
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
  const targetModelId = pref?.modelId || 'lfm2.5-350m-qad-cpu';
  const targetCtx = pref?.nCtx || 1024;
  return enableAI(targetModelId, { nCtx: targetCtx });
}

export function complete(
  messages,
  {
    temperature = 0.65,
    max_tokens = 110,
    onToken,
    onSentence,
    firstTokenTimeoutMs = ai.backend === 'cpu' ? 60000 : 45000,
    tokenTimeoutMs = 15000,
    totalTimeoutMs = 120000,
  } = {}
) {
  const controller = new AbortController();
  const run = epoch;
  const job = { controller, stopping: false };
  jobs.add(job);

  const task = async () => {
    if (controller.signal.aborted) throw controller.signal.reason;
    if (run !== epoch || ai.status !== 'ready' || !ai.engine) {
      throw new Error('Local AI brain is not loaded yet.');
    }
    activeJob = job;
    update({ busy: true });

    const engine = ai.engine;
    const started = Date.now();
    let rawOutput = '';
    let sentenceBuffer = '';
    let emittedChunks = 0;
    let first = true;
    let tokenCount = 0;

    const bounded = (promise) =>
      waitForAI(promise, {
        signal: controller.signal,
        timeoutMs: Math.max(
          1,
          Math.min(first ? firstTokenTimeoutMs : tokenTimeoutMs, totalTimeoutMs - (Date.now() - started))
        ),
        message: first ? 'BMO took too long to start replying.' : 'BMO generation timed out.',
      });

    try {
      const response = await bounded(
        engine.chat.completions.create({
          messages,
          temperature,
          top_p: 0.9,
          repeat_penalty: 1.12,
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
            const extracted = extractSentences(sentenceBuffer, { firstChunk: emittedChunks === 0 });
            sentenceBuffer = extracted.buffer;
            for (const s of extracted.sentences) {
              const cleanSentence = cleanOutput(s);
              if (cleanSentence) {
                emittedChunks++;
                onSentence?.(cleanSentence);
              }
            }
          }
        }
      }
      if (job.stopping) {
        const error = abortError('Generation stopped.');
        error.partial = cleanOutput(rawOutput);
        throw error;
      }
      const flushed = extractSentences(sentenceBuffer, { flush: true });
      for (const s of flushed.sentences) {
        const cleanSentence = cleanOutput(s);
        if (cleanSentence) {
          emittedChunks++;
          onSentence?.(cleanSentence);
        }
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
