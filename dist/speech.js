import { visemeAtTime, buildFallbackTimeline } from './visemes.js?v=2';

export const speech = {
  status: 'idle', // 'idle' | 'speaking'
  voiceStatus: 'loading', // 'loading' | 'ready' | 'error'
  voiceProgress: 0,
  voiceText: 'Loading BMO ONNX voice…',
  currentViseme: 'Neutral',
  currentSentence: '',
  lengthScale: 1.0,
  audioUnlocked: false,
  autoplayBlocked: false,
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
let activeAudioEl = null;
let activeTimer = null;
let activeRaf = null;
let piperWorker = null;
let workerReqId = 0;
const pendingSynth = new Map();
let initPromise = null;
let playbackToken = 0;
let playbackQueue = Promise.resolve();
let pendingBlockedSpeech = null;

export function getAudioContext() {
  const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) {
    audioContext = new Ctor();
    audioContext.addEventListener?.('statechange', () => {
      if (audioContext.state === 'running') {
        update({ audioUnlocked: true, autoplayBlocked: false });
      }
    });
  }
  return audioContext;
}

/**
 * Attempts to unlock WebAudio without ever hanging if called outside a user gesture.
 */
export async function unlockAudio() {
  const ctx = getAudioContext();
  if (!ctx) return false;
  if (ctx.state === 'running') {
    if (!speech.audioUnlocked) update({ audioUnlocked: true, autoplayBlocked: false });
    return true;
  }
  try {
    const resumePromise = ctx.resume();
    try {
      const empty = ctx.createBuffer(1, 1, ctx.sampleRate || 16000);
      const node = ctx.createBufferSource();
      node.buffer = empty;
      node.connect(ctx.destination);
      node.start(0);
      node.onended = () => node.disconnect();
    } catch {}

    await Promise.race([
      Promise.resolve(resumePromise).catch(() => {}),
      new Promise((r) => setTimeout(r, 120)),
    ]);

    const ok = ctx.state === 'running';
    if (ok) {
      update({ audioUnlocked: true, autoplayBlocked: false });
    }
    return ok;
  } catch {
    return false;
  }
}

/**
 * If a greeting was blocked by browser autoplay policy before the user's first click,
 * replay it immediately as soon as the user interacts with the page.
 */
export function flushPendingSpeech() {
  void unlockAudio().then((ok) => {
    if (ok && pendingBlockedSpeech && speech.status === 'idle') {
      const item = pendingBlockedSpeech;
      pendingBlockedSpeech = null;
      update({ autoplayBlocked: false });
      const token = playbackToken;
      playbackQueue = playbackQueue
        .then(() => playSynthesizedResult(item.synthResult, item.sentenceText, token))
        .finally(() => {
          if (token === playbackToken) {
            emitViseme('Neutral');
            update({ status: 'idle', currentSentence: '' });
          }
        });
    }
  });
}

function encodeWavBlob(pcmFloat32, sampleRate = 16000) {
  const numSamples = pcmFloat32.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, pcmFloat32[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function ensureWorker() {
  if (piperWorker) return piperWorker;
  piperWorker = new Worker(new URL('./piper-worker.js?v=2', import.meta.url), { type: 'module' });
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

export function synthesizePiper(text, lengthScale = speech.lengthScale) {
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
  pendingBlockedSpeech = null;
  playbackQueue = Promise.resolve();
  stopActiveSync();
  if (activeSource) {
    try {
      activeSource.stop();
      activeSource.disconnect();
    } catch {}
    activeSource = null;
  }
  if (activeAudioEl) {
    try {
      activeAudioEl.pause();
      activeAudioEl.src = '';
    } catch {}
    activeAudioEl = null;
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

function playViaHtmlAudioElement(pcmFloat32, sampleRate, timeline, duration, token) {
  return new Promise((resolve) => {
    if (typeof Audio === 'undefined') {
      resolve(false);
      return;
    }
    const blob = encodeWavBlob(pcmFloat32, sampleRate);
    const url = URL.createObjectURL(blob);
    const audioEl = new Audio(url);
    activeAudioEl = audioEl;
    let finished = false;

    const cleanup = (ok) => {
      if (finished) return;
      finished = true;
      stopActiveSync();
      if (activeAudioEl === audioEl) activeAudioEl = null;
      URL.revokeObjectURL(url);
      emitViseme('Neutral');
      resolve(ok);
    };

    audioEl.onended = () => cleanup(true);
    audioEl.onerror = () => cleanup(false);

    activeTimer = setInterval(() => {
      if (finished || token !== playbackToken) {
        cleanup(false);
        return;
      }
      const elapsed = audioEl.currentTime || 0;
      if (elapsed >= duration + 0.08) {
        cleanup(true);
        return;
      }
      emitViseme(visemeAtTime(timeline, elapsed));
    }, 12);

    audioEl.play().then(
      () => {
        update({ audioUnlocked: true, autoplayBlocked: false });
      },
      () => {
        cleanup(false);
      }
    );
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
    // Try HTMLAudioElement WAV fallback first
    const playedHtml = await playViaHtmlAudioElement(pcmFloat32, sampleRate, timeline, duration, token);
    if (playedHtml || token !== playbackToken) return;

    // Browser blocked autoplay before user's first gesture: queue for instant replay on first click/tap
    pendingBlockedSpeech = { synthResult, sentenceText };
    update({ autoplayBlocked: true });
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

    const gainNode = ctx.createGain();
    gainNode.gain.value = 1.1;
    source.connect(gainNode);
    gainNode.connect(ctx.destination);
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
        gainNode.disconnect();
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
      source.start(0);
      syncMouth();
    } catch {
      finish();
    }
  });
}

function queueSingleSentence(clean, lengthScale, fullCaptionText) {
  const token = playbackToken;

  if (speech.status !== 'speaking') {
    update({
      status: 'speaking',
      currentSentence: fullCaptionText || clean,
    });
  }

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
    await playSynthesizedResult(result, fullCaptionText || clean, token);
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

/**
 * Queues text for BMO to speak with Piper ONNX + viseme mouth synchronization.
 * Automatically splits multi-sentence text into pipelined clauses so the first
 * sentence starts speaking in ~150ms while subsequent sentences synthesize in parallel!
 */
export function speakSentence(text, { lengthScale = speech.lengthScale } = {}) {
  const clean = String(text || '').trim();
  if (!clean) return Promise.resolve(false);

  const clauses = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (clauses.length <= 1) {
    return queueSingleSentence(clean, lengthScale, clean);
  }

  let lastPromise = Promise.resolve(false);
  for (const clause of clauses) {
    lastPromise = queueSingleSentence(clause, lengthScale, clean);
  }
  return lastPromise;
}
