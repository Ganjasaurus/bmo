import { pipeline, env } from './vendor/transformers.min.js';

env.allowLocalModels = false;
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.numThreads = 1;
}

const MODEL_ID = 'onnx-community/moonshine-tiny-ONNX';

let transcriberPromise = null;

const NOISE_PATTERNS = /^(?:\[.*?\]|\(.*?\)|\*.*?\*|\.+|,|-|\s|you|thank you\.?)$/i;

function normalizeAndPad16k(pcmFloat32) {
  const src = pcmFloat32 instanceof Float32Array ? pcmFloat32 : new Float32Array(pcmFloat32 || []);
  if (!src.length) return new Float32Array(0);

  // Remove DC offset and find peak
  let mean = 0;
  for (let i = 0; i < src.length; i++) {
    mean += src[i];
  }
  mean /= src.length;

  let peak = 0;
  let sumSq = 0;
  for (let i = 0; i < src.length; i++) {
    const v = src[i] - mean;
    const a = Math.abs(v);
    if (a > peak) peak = a;
    sumSq += v * v;
  }

  const rms = Math.sqrt(sumSq / src.length);
  if (rms < 0.0015 || peak < 0.004) {
    return new Float32Array(0);
  }

  const gain = Math.min(18, 0.85 / peak);
  // Pad 0.15s leading silence + 0.50s trailing silence so Moonshine never truncates first/last syllables
  const leadSamples = 2400;
  const tailSamples = 8000;
  const out = new Float32Array(leadSamples + src.length + tailSamples);
  for (let i = 0; i < src.length; i++) {
    out[leadSamples + i] = Math.max(-0.98, Math.min(0.98, (src[i] - mean) * gain));
  }
  return out;
}

async function loadTranscriber() {
  if (transcriberPromise) return transcriberPromise;
  transcriberPromise = (async () => {
    self.postMessage({
      type: 'status',
      progress: 0.1,
      text: 'Loading local voice ear (Moonshine ONNX)…',
    });

    const tr = await pipeline('automatic-speech-recognition', MODEL_ID, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (info) => {
        if (info?.status === 'progress' && typeof info.progress === 'number') {
          self.postMessage({
            type: 'status',
            progress: Math.min(0.95, Math.max(0.1, info.progress / 100)),
            text: `Loading voice ear · ${Math.round(info.progress)}%`,
          });
        }
      },
    });

    self.postMessage({
      type: 'ready',
      modelId: MODEL_ID,
    });
    return tr;
  })().catch((err) => {
    transcriberPromise = null;
    throw err;
  });

  return transcriberPromise;
}

self.onmessage = async ({ data }) => {
  if (!data) return;

  if (data.type === 'init') {
    try {
      await loadTranscriber();
    } catch (err) {
      self.postMessage({
        type: 'error',
        error: err?.message || String(err),
      });
    }
    return;
  }

  if (data.type === 'transcribe') {
    const id = data.id;
    try {
      const prepared = normalizeAndPad16k(data.pcmFloat32);
      if (!prepared.length) {
        self.postMessage({ type: 'result', id, text: '' });
        return;
      }
      const tr = await loadTranscriber();
      const output = await tr(prepared, { max_new_tokens: 64 });
      const rawText = String(output?.text || '').trim();
      const cleaned = rawText
        .replace(/\[.*?\]|\(.*?\)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      const valid = cleaned && !NOISE_PATTERNS.test(cleaned) ? cleaned : '';
      self.postMessage({
        type: 'result',
        id,
        text: valid,
      });
    } catch (err) {
      self.postMessage({
        type: 'result',
        id,
        text: '',
        error: err?.message || String(err),
      });
    }
  }
};
