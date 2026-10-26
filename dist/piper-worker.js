import initializeEspeak from './vendor/speech/espeak-ng.js';
import * as ortModule from './vendor/ort/ort.wasm.min.mjs';
import {
  phonemizeClauseText,
  phonemesToIds,
  buildTimeline,
} from './visemes.js?v=1';

const ort = ortModule.default || ortModule;
ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = new URL('./vendor/ort/', self.location.href).href;

const DB_NAME = 'bmo-voice-store-v1';
const STORE_NAME = 'models';

function openCacheDB() {
  return new Promise((resolve, reject) => {
    if (!self.indexedDB) {
      resolve(null);
      return;
    }
    const req = self.indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

async function getCachedModel(key) {
  const db = await openCacheDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function setCachedModel(key, bytes) {
  const db = await openCacheDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(bytes, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

let enginePromise = null;

async function fetchPartWithProgress(url, onBytes) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url} (${res.status})`);
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    onBytes(buf.byteLength);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    length += value.byteLength;
    onBytes(value.byteLength);
  }
  const out = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

async function loadPiperEngine() {
  if (enginePromise) return enginePromise;
  enginePromise = (async () => {
    self.postMessage({ type: 'status', phase: 'espeak', progress: 0.05, text: 'Loading eSpeak-NG phonemizer…' });
    const [espeakMod, configRes, manifestRes] = await Promise.all([
      initializeEspeak(),
      fetch(new URL('./assets/voice/bmo.onnx.json', self.location.href)),
      fetch(new URL('./assets/voice/manifest.json', self.location.href)),
    ]);
    if (!configRes.ok) throw new Error('Could not load bmo.onnx.json');
    if (!manifestRes.ok) throw new Error('Could not load voice manifest.json');

    const config = await configRes.json();
    const manifest = await manifestRes.json();

    const espeakVoice = new espeakMod.eSpeakNGWorker();
    try {
      espeakVoice.set_voice(config?.espeak?.voice || 'en-gb-x-rp');
    } catch {
      espeakVoice.set_voice('en-us');
    }

    const cacheKey = `bmo-onnx-${manifest.sha256}`;
    let modelBytes = await getCachedModel(cacheKey);
    let fromCache = false;

    if (modelBytes && modelBytes.byteLength === manifest.totalBytes) {
      fromCache = true;
      self.postMessage({
        type: 'status',
        phase: 'cached',
        progress: 0.85,
        text: 'Loading cached BMO ONNX voice…',
      });
    } else {
      let loadedBytes = 0;
      const totalBytes = manifest.totalBytes || 63104544;
      const parts = await Promise.all(
        manifest.parts.map((part) =>
          fetchPartWithProgress(new URL('./assets/voice/' + part.name, self.location.href), (delta) => {
            loadedBytes += delta;
            const fraction = Math.min(1, loadedBytes / totalBytes);
            self.postMessage({
              type: 'status',
              phase: 'download',
              progress: Math.min(0.85, 0.1 + fraction * 0.75),
              text: `Loading BMO ONNX voice · ${Math.round(loadedBytes / 1000000)} / ${Math.round(totalBytes / 1000000)} MB`,
            });
          })
        )
      );
      modelBytes = new Uint8Array(totalBytes);
      let offset = 0;
      for (const p of parts) {
        modelBytes.set(p, offset);
        offset += p.byteLength;
      }
      void setCachedModel(cacheKey, modelBytes);
    }

    self.postMessage({
      type: 'status',
      phase: 'session',
      progress: 0.92,
      text: 'Initializing BMO ONNX Runtime session…',
    });

    const session = await ort.InferenceSession.create(modelBytes, {
      executionProviders: ['wasm'],
    });

    self.postMessage({
      type: 'ready',
      fromCache,
      sampleRate: config?.audio?.sample_rate || 16000,
    });

    return { session, config, espeakVoice };
  })().catch((err) => {
    enginePromise = null;
    throw err;
  });

  return enginePromise;
}

async function synthesizeSentence(text, lengthScaleOverride) {
  const { session, config, espeakVoice } = await loadPiperEngine();
  const sampleRate = config?.audio?.sample_rate || 16000;
  const noiseScale = config?.inference?.noise_scale ?? 0.667;
  const lengthScale = lengthScaleOverride ?? config?.inference?.length_scale ?? 1.0;
  const noiseW = config?.inference?.noise_w ?? 0.8;
  const hopLength = 256;

  const sentencePhonemes = phonemizeClauseText(text, (clause) => espeakVoice.synthesize_ipa(clause));
  if (!sentencePhonemes.length) {
    return {
      pcmFloat32: new Float32Array(0),
      sampleRate,
      timeline: [],
      duration: 0,
    };
  }

  const audioParts = [];
  const fullTimeline = [];
  let timeOffset = 0;

  for (const phonemes of sentencePhonemes) {
    if (!phonemes.length) continue;
    const phonemeIds = phonemesToIds(phonemes, config.phoneme_id_map);
    const input = new ort.Tensor('int64', BigInt64Array.from(phonemeIds.map(BigInt)), [1, phonemeIds.length]);
    const inputLengths = new ort.Tensor('int64', BigInt64Array.from([BigInt(phonemeIds.length)]), [1]);
    const scales = new ort.Tensor('float32', Float32Array.from([noiseScale, lengthScale, noiseW]), [3]);

    const results = await session.run({
      input,
      input_lengths: inputLengths,
      scales,
    });

    const rawAudio = results.output?.data || Object.values(results)[0]?.data;
    const rawAlign = results['/Ceil_output_0']?.data || Object.values(results)[1]?.data;

    const chunkAudio = new Float32Array(rawAudio.length);
    let peak = 0;
    for (let i = 0; i < rawAudio.length; i++) {
      const a = Math.abs(rawAudio[i]);
      if (a > peak) peak = a;
    }
    const gain = peak > 0.98 ? 0.95 / peak : 1.0;
    for (let i = 0; i < rawAudio.length; i++) {
      chunkAudio[i] = rawAudio[i] * gain;
    }
    audioParts.push(chunkAudio);

    if (rawAlign && rawAlign.length) {
      const sampleCounts = new Array(rawAlign.length);
      for (let i = 0; i < rawAlign.length; i++) {
        sampleCounts[i] = Math.round(rawAlign[i] * hopLength);
      }
      const chunkTimeline = buildTimeline(phonemes, phonemeIds, sampleCounts, sampleRate);
      for (const item of chunkTimeline) {
        fullTimeline.push({
          start: item.start + timeOffset,
          end: item.end + timeOffset,
          phoneme: item.phoneme,
          viseme: item.viseme,
        });
      }
    }

    timeOffset += chunkAudio.length / sampleRate;
  }

  const totalSamples = audioParts.reduce((sum, a) => sum + a.length, 0);
  const pcmFloat32 = new Float32Array(totalSamples);
  let offset = 0;
  for (const part of audioParts) {
    pcmFloat32.set(part, offset);
    offset += part.length;
  }

  return {
    pcmFloat32,
    sampleRate,
    timeline: fullTimeline,
    duration: totalSamples / sampleRate,
  };
}

self.onmessage = async ({ data }) => {
  if (!data) return;
  if (data.type === 'init') {
    try {
      await loadPiperEngine();
    } catch (error) {
      self.postMessage({
        type: 'error',
        error: error?.message || String(error),
      });
    }
    return;
  }

  if (data.type === 'synthesize') {
    try {
      const result = await synthesizeSentence(data.text, data.lengthScale);
      self.postMessage(
        {
          type: 'result',
          id: data.id,
          pcmFloat32: result.pcmFloat32,
          sampleRate: result.sampleRate,
          timeline: result.timeline,
          duration: result.duration,
        },
        [result.pcmFloat32.buffer]
      );
    } catch (error) {
      self.postMessage({
        type: 'result',
        id: data.id,
        error: error?.message || String(error),
      });
    }
  }
};
