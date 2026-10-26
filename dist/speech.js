import { visemeAtTime, buildFallbackTimeline } from './visemes.js?v=1';

export const speech = {
  status: 'idle', // 'idle' | 'speaking'
  voiceStatus: 'loading', // 'loading' | 'ready' | 'error'
  voiceProgress: 0,
  voiceText: 'Loading BMO ONNX voice…',
  currentViseme: 'Neutral',
  currentSentence: '',
  lengthScale: 1.0,
  audioUnlocked: false,
  lastTimelineCount: 0,
  lastAudioDuration: 0,
};

const listeners = new Set();
const visemeListeners = new Set();

export function subscribeSpeech(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function subscribeViseme(fn) {
  visemeListeners.add(fn);
  return () => visemeListeners.delete(fn);
}

function update(patch) {
  Object.assign(speech, patch);
  for (const fn of listeners) {
    try {
      fn(speech);
    } catch {}
  }
}

function emitViseme(name) {
  const viseme = name || 'Neutral';
  if (speech.currentViseme === viseme) return;
  speech.currentViseme = viseme;
  for (const fn of visemeListeners) {
    try {
      fn(viseme);
    } catch {}
  }
}

let audioContext = null;
let activeSource = null;
let activeTimer = null;
let activeRaf = null;
let piperWorker = null;
let workerReqId = 0;
const pendingSynth = new Map();
let initPromise = null;
let playbackToken = 0;
let playbackQueue = Promise.resolve();

export function getAudioContext() {
  const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) {
    audioContext = new Ctor();
  }
  return audioContext;
}

export function unlockAudio() {
  const ctx = getAudioContext();
  if (!ctx) return Promise.resolve(false);
  try {
    const resumed = ctx.resume();
    const empty = ctx.createBuffer(1, 1, ctx.sampleRate || 16000);
    const node = ctx.createBufferSource();
    node.buffer = empty;
    node.connect(ctx.destination);
    node.start();
    node.onended = () => node.disconnect();
    return Promise.resolve(resumed).then(
      () => {
        const ok = ctx.state === 'running';
        if (ok) update({ audioUnlocked: true });
        return ok;
      },
      () => false
    );
  } catch {
    return Promise.resolve(false);
  }
}

function ensureWorker() {
  if (piperWorker) return piperWorker;
  piperWorker = new Worker(new URL('./piper-worker.js?v=1', import.meta.url), { type: 'module' });
  piperWorker.onmessage = ({ data }) => {
    if (!data) return;
    if (data.type === 'status') {
      update({
        voiceStatus: 'loading',
        voiceProgress: data.progress ?? speech.voiceProgress,
        voiceText: data.text || speech.voiceText,
      });
      return;
    }
    if (data.type === 'ready') {
      update({
        voiceStatus: 'ready',
        voiceProgress: 1,
        voiceText: 'BMO ONNX Voice Ready',
      });
      return;
    }
    if (data.type === 'error') {
      update({
        voiceStatus: 'error',
        voiceText: data.error || 'BMO ONNX voice failed to load.',
      });
      return;
    }
    if (data.type === 'result') {
      const entry = pendingSynth.get(data.id);
      if (!entry) return;
      pendingSynth.delete(data.id);
      clearTimeout(entry.timer);
      if (data.error) {
        entry.reject(new Error(data.error));
      } else {
        entry.resolve(data);
      }
    }
  };
  piperWorker.onerror = (e) => {
    e.preventDefault?.();
    update({
      voiceStatus: 'error',
      voiceText: 'BMO ONNX voice worker error.',
    });
  };
  return piperWorker;
}

export function initVoice() {
  if (initPromise) return initPromise;
  initPromise = new Promise((resolve) => {
    try {
      const w = ensureWorker();
      const unsub = subscribeSpeech((s) => {
        if (s.voiceStatus === 'ready' || s.voiceStatus === 'error') {
          unsub();
          resolve(s.voiceStatus === 'ready');
        }
      });
      w.postMessage({ type: 'init' });
    } catch {
      update({ voiceStatus: 'error', voiceText: 'Web Workers unavailable.' });
      resolve(false);
    }
  });
  return initPromise;
}

function synthesizePiper(text, lengthScale = speech.lengthScale) {
  const w = ensureWorker();
  return new Promise((resolve, reject) => {
    const id = ++workerReqId;
    const timer = setTimeout(() => {
      pendingSynth.delete(id);
      reject(new Error('BMO ONNX synthesis timed out.'));
    }, 90000);
    pendingSynth.set(id, { resolve, reject, timer });
    w.postMessage({
      type: 'synthesize',
      id,
      text,
      lengthScale,
    });
  });
}

function stopActiveSync() {
  if (activeTimer) {
    clearInterval(activeTimer);
    activeTimer = null;
  }
  if (activeRaf && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(activeRaf);
    activeRaf = null;
  }
}

export function stopSpeech() {
  playbackToken++;
  playbackQueue = Promise.resolve();
  stopActiveSync();
  if (activeSource) {
    try {
      activeSource.stop();
      activeSource.disconnect();
    } catch {}
    activeSource = null;
  }
  emitViseme('Neutral');
  update({ status: 'idle', currentSentence: '' });
}

function animateTimelineOnly(timeline, durationSec, token) {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    const tick = () => {
      if (token !== playbackToken) {
        stopActiveSync();
        resolve();
        return;
      }
      const elapsed = (performance.now() - startedAt) / 1000;
      if (elapsed >= durationSec) {
        stopActiveSync();
        emitViseme('Neutral');
        resolve();
        return;
      }
      emitViseme(visemeAtTime(timeline, elapsed));
    };
    activeTimer = setInterval(tick, 12);
    tick();
  });
}

async function playSynthesizedResult(synthResult, sentenceText, token) {
  if (token !== playbackToken) return;
  const { pcmFloat32, sampleRate = 16000, timeline = [], duration = 0 } = synthResult;
  if (!pcmFloat32 || !pcmFloat32.length || duration <= 0) return;

  update({
    status: 'speaking',
    currentSentence: sentenceText,
    lastTimelineCount: timeline.length,
    lastAudioDuration: Number(duration.toFixed(3)),
  });

  await unlockAudio();
  const ctx = getAudioContext();

  if (!ctx || ctx.state !== 'running') {
    // Still animate BMO's viseme mouth timeline even if browser AudioContext awaits user gesture
    await animateTimelineOnly(timeline, duration, token);
    return;
  }

  return new Promise((resolve) => {
    if (token !== playbackToken) {
      resolve();
      return;
    }

    const buffer = ctx.createBuffer(1, pcmFloat32.length, sampleRate);
    buffer.getChannelData(0).set(pcmFloat32);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    activeSource = source;

    const startTime = ctx.currentTime;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      stopActiveSync();
      if (activeSource === source) activeSource = null;
      try {
        source.disconnect();
      } catch {}
      emitViseme('Neutral');
      resolve();
    };

    const syncMouth = () => {
      if (finished || token !== playbackToken) return;
      const elapsed = ctx.currentTime - startTime;
      if (elapsed >= duration) {
        emitViseme('Neutral');
        return;
      }
      const v = visemeAtTime(timeline, elapsed);
      emitViseme(v);
      if (typeof requestAnimationFrame === 'function') {
        activeRaf = requestAnimationFrame(syncMouth);
      }
    };

    source.onended = finish;
    activeTimer = setInterval(() => {
      if (finished || token !== playbackToken) return;
      const elapsed = ctx.currentTime - startTime;
      if (elapsed >= duration + 0.08) {
        finish();
        return;
      }
      emitViseme(visemeAtTime(timeline, elapsed));
    }, 10);

    try {
      source.start();
      syncMouth();
    } catch {
      finish();
    }
  });
}

/**
 * Queues a sentence for BMO to speak with Piper ONNX + viseme mouth synchronization.
 * Pre-synthesizes immediately in the worker while waiting for any earlier sentence to finish playing!
 */
export function speakSentence(text, { lengthScale = speech.lengthScale } = {}) {
  const clean = String(text || '').trim();
  if (!clean) return Promise.resolve(false);

  const token = playbackToken;

  // Start synthesizing in Piper ONNX worker immediately so sentences pipeline with zero gap
  const synthPromise = synthesizePiper(clean, lengthScale).catch(() => {
    const estDuration = Math.max(0.6, clean.length * 0.055);
    return {
      pcmFloat32: new Float32Array(Math.round(estDuration * 16000)),
      sampleRate: 16000,
      timeline: buildFallbackTimeline(clean, estDuration),
      duration: estDuration,
    };
  });

  const job = async () => {
    if (token !== playbackToken) return false;
    const result = await synthPromise;
    if (token !== playbackToken) return false;
    await playSynthesizedResult(result, clean, token);
    return true;
  };

  const next = playbackQueue.then(job, job).finally(() => {
    if (playbackQueue === next && token === playbackToken) {
      emitViseme('Neutral');
      update({ status: 'idle', currentSentence: '' });
    }
  });

  playbackQueue = next;
  return next;
}
