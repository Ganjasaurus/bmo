import { unlockAudio, getAudioContext, flushPendingSpeech } from './speech.js?v=2';

export const mic = {
  permission: 'prompt', // 'prompt' | 'granted' | 'denied' | 'unsupported'
  listening: false,
  autoListen: true,
  pausedForSpeech: false,
  vadActive: false,
  transcribing: false,
  sttStatus: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
  sttProgress: 0,
  sttText: 'Voice ear ready',
  level: 0,
  interimText: '',
  error: null,
};

const listeners = new Set();
let transcriptCallback = null;
let mediaStream = null;
let recognition = null;
let srBroken = false;
let lastSrFinalAt = 0;

let mediaSource = null;
let analyser = null;
let processorNode = null;
let zeroGainNode = null;
let levelRaf = null;
let restartTimer = null;

// Local Moonshine ONNX Speech-to-Text Worker state
let sttWorker = null;
let sttInitPromise = null;
let sttReqId = 0;
const pendingStt = new Map();

// WebAudio 16kHz VAD capture state
const TARGET_SR = 16000;
const PRE_ROLL_SAMPLES = 5600; // 350ms @ 16kHz
let preRollChunks = [];
let preRollLength = 0;
let speechChunks = [];
let speechSamples = 0;
let speechPeakRms = 0;
let consecutiveSpeechFrames = 0;
let silenceMs = 0;
let noiseFloor = 0.0055;
let vadSpeaking = false;

export function subscribeMic(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function update(patch) {
  Object.assign(mic, patch);
  for (const fn of listeners) {
    try {
      fn(mic);
    } catch {}
  }
}

export function onTranscription(fn) {
  transcriptCallback = fn;
}

function ensureSttWorker() {
  if (sttWorker) return sttWorker;
  sttWorker = new Worker(new URL('./stt-worker.js?v=2', import.meta.url), { type: 'module' });
  sttWorker.onmessage = ({ data }) => {
    if (!data) return;
    if (data.type === 'status') {
      update({
        sttStatus: 'loading',
        sttProgress: data.progress ?? mic.sttProgress,
        sttText: data.text || mic.sttText,
      });
      return;
    }
    if (data.type === 'ready') {
      update({
        sttStatus: 'ready',
        sttProgress: 1,
        sttText: 'Local Moonshine Voice Ear Ready',
      });
      return;
    }
    if (data.type === 'error') {
      update({
        sttStatus: 'error',
        sttText: data.error || 'Voice ear error',
      });
      return;
    }
    if (data.type === 'result') {
      const entry = pendingStt.get(data.id);
      if (!entry) return;
      pendingStt.delete(data.id);
      clearTimeout(entry.timer);
      entry.resolve(data.text || '');
    }
  };
  sttWorker.onerror = (e) => {
    e.preventDefault?.();
    update({ sttStatus: 'error', sttText: 'Voice ear worker error' });
  };
  return sttWorker;
}

export function initSTT() {
  if (sttInitPromise) return sttInitPromise;
  sttInitPromise = new Promise((resolve) => {
    try {
      const w = ensureSttWorker();
      update({ sttStatus: 'loading', sttProgress: 0.05, sttText: 'Loading local voice ear…' });
      const unsub = subscribeMic((m) => {
        if (m.sttStatus === 'ready' || m.sttStatus === 'error') {
          unsub();
          resolve(m.sttStatus === 'ready');
        }
      });
      w.postMessage({ type: 'init' });
    } catch {
      update({ sttStatus: 'error' });
      resolve(false);
    }
  });
  return sttInitPromise;
}

export function downsampleTo16k(inputFloat32, inputSampleRate) {
  if (!inputFloat32 || !inputFloat32.length) return new Float32Array(0);
  if (!inputSampleRate || inputSampleRate === TARGET_SR) {
    return new Float32Array(inputFloat32);
  }
  const ratio = inputSampleRate / TARGET_SR;
  const outLength = Math.max(1, Math.round(inputFloat32.length / ratio));
  const output = new Float32Array(outLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < outLength) {
    const nextOffsetBuffer = Math.min(inputFloat32.length, Math.round((offsetResult + 1) * ratio));
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer; i++) {
      accum += inputFloat32[i];
      count++;
    }
    output[offsetResult] = count > 0 ? accum / count : inputFloat32[Math.min(inputFloat32.length - 1, offsetBuffer)];
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return output;
}

/**
 * Transcribes a Float32Array of mono PCM audio using the local Moonshine ONNX worker.
 */
export async function transcribeAudioFloat32(pcmFloat32, sampleRate = TARGET_SR) {
  const mono16k = sampleRate === TARGET_SR ? new Float32Array(pcmFloat32) : downsampleTo16k(pcmFloat32, sampleRate);
  if (!mono16k.length) return '';

  const w = ensureSttWorker();
  update({ transcribing: true, interimText: 'Transcribing…' });

  try {
    const text = await new Promise((resolve) => {
      const id = ++sttReqId;
      const timer = setTimeout(() => {
        pendingStt.delete(id);
        resolve('');
      }, 45000);
      pendingStt.set(id, { resolve, timer });
      w.postMessage(
        {
          type: 'transcribe',
          id,
          pcmFloat32: mono16k,
        },
        [mono16k.buffer]
      );
    });

    const clean = String(text || '').trim();
    update({ transcribing: false, interimText: '' });
    if (clean && !mic.pausedForSpeech) {
      transcriptCallback?.(clean);
    }
    return clean;
  } catch {
    update({ transcribing: false, interimText: '' });
    return '';
  }
}

function resetVadBuffer() {
  speechChunks = [];
  speechSamples = 0;
  speechPeakRms = 0;
  consecutiveSpeechFrames = 0;
  silenceMs = 0;
  if (vadSpeaking) {
    vadSpeaking = false;
    update({ vadActive: false, ...(mic.transcribing ? {} : { interimText: '' }) });
  }
}

function flushVadUtterance() {
  if (!speechChunks.length || speechSamples < TARGET_SR * 0.22 || speechPeakRms < 0.01) {
    resetVadBuffer();
    return;
  }
  const merged = new Float32Array(speechSamples);
  let offset = 0;
  for (const c of speechChunks) {
    merged.set(c, offset);
    offset += c.length;
  }
  resetVadBuffer();

  // If browser SpeechRecognition already emitted a final transcript in the last 1.4s, skip duplicate
  if (Date.now() - lastSrFinalAt < 1400) {
    return;
  }
  void transcribeAudioFloat32(merged, TARGET_SR);
}

function pushPreRoll(chunk16k) {
  preRollChunks.push(chunk16k);
  preRollLength += chunk16k.length;
  while (preRollLength > PRE_ROLL_SAMPLES && preRollChunks.length > 1) {
    const removed = preRollChunks.shift();
    preRollLength -= removed.length;
  }
}

function processMicFrame(inputFrame, sampleRate) {
  if (!inputFrame || !inputFrame.length) return;

  // Compute true time-domain RMS
  let sumSq = 0;
  for (let i = 0; i < inputFrame.length; i++) {
    const s = inputFrame[i];
    sumSq += s * s;
  }
  const rms = Math.sqrt(sumSq / inputFrame.length);
  const visualLevel = Math.min(1, Number((Math.sqrt(rms) * 3.4).toFixed(2)));
  if (Math.abs(visualLevel - mic.level) > 0.02) {
    update({ level: visualLevel });
  }

  if (!mic.listening || mic.pausedForSpeech) {
    if (vadSpeaking) resetVadBuffer();
    return;
  }

  const chunk16k = downsampleTo16k(inputFrame, sampleRate);
  const frameMs = (chunk16k.length / TARGET_SR) * 1000;

  const startThreshold = Math.max(0.012, noiseFloor * 1.9 + 0.006);
  const keepThreshold = Math.max(0.008, noiseFloor * 1.45 + 0.003);

  if (!vadSpeaking) {
    pushPreRoll(chunk16k);
    if (rms >= startThreshold) {
      consecutiveSpeechFrames++;
      if (consecutiveSpeechFrames >= 2) {
        vadSpeaking = true;
        silenceMs = 0;
        speechPeakRms = rms;
        speechChunks = [...preRollChunks];
        speechSamples = preRollLength;
        preRollChunks = [];
        preRollLength = 0;
        update({ vadActive: true, interimText: 'Hearing you…' });
      } else {
        // Slowly adapt noise floor if single spike or steady tone
        noiseFloor = Math.max(0.0025, Math.min(0.35, noiseFloor * 0.92 + rms * 0.08));
      }
    } else {
      consecutiveSpeechFrames = 0;
      noiseFloor = Math.max(0.0025, Math.min(0.35, noiseFloor * 0.9 + rms * 0.1));
    }
  } else {
    speechChunks.push(chunk16k);
    speechSamples += chunk16k.length;
    if (rms > speechPeakRms) speechPeakRms = rms;

    if (rms >= keepThreshold) {
      silenceMs = 0;
    } else {
      silenceMs += frameMs;
    }

    const totalSpeechMs = (speechSamples / TARGET_SR) * 1000;
    if (silenceMs >= 680 || totalSpeechMs >= 9000) {
      if (totalSpeechMs >= 9000) {
        // Adapt noise floor if a continuous tone lasted 9s
        noiseFloor = Math.max(0.0025, Math.min(0.35, rms));
      }
      flushVadUtterance();
    }
  }
}

function setupAudioCaptureGraph(stream) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }

    if (mediaSource) {
      try {
        mediaSource.disconnect();
      } catch {}
    }
    if (processorNode) {
      try {
        processorNode.disconnect();
      } catch {}
    }
    if (zeroGainNode) {
      try {
        zeroGainNode.disconnect();
      } catch {}
    }

    mediaSource = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.4;
    mediaSource.connect(analyser);

    // Use ScriptProcessorNode (supported across all desktop & mobile browsers) for 16kHz VAD + STT capture
    if (typeof ctx.createScriptProcessor === 'function') {
      processorNode = ctx.createScriptProcessor(4096, 1, 1);
      zeroGainNode = ctx.createGain();
      zeroGainNode.gain.value = 0;

      processorNode.onaudioprocess = (event) => {
        const input = event.inputBuffer?.getChannelData(0);
        if (input) {
          processMicFrame(input, ctx.sampleRate || 48000);
        }
      };

      mediaSource.connect(processorNode);
      processorNode.connect(zeroGainNode);
      zeroGainNode.connect(ctx.destination);
    }

    // Also run a fast time-domain RMS visual level meter via AnalyserNode
    const timeData = new Float32Array(analyser.fftSize);
    if (levelRaf && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(levelRaf);
    }
    const sampleVisualLevel = () => {
      if (!analyser) return;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      } else if (typeof analyser.getFloatTimeDomainData === 'function') {
        analyser.getFloatTimeDomainData(timeData);
        let sumSq = 0;
        for (let i = 0; i < timeData.length; i++) {
          sumSq += timeData[i] * timeData[i];
        }
        const rms = Math.sqrt(sumSq / timeData.length);
        const level = Math.min(1, Number((Math.sqrt(rms) * 3.4).toFixed(2)));
        if (Math.abs(level - mic.level) > 0.025) {
          update({ level });
        }
      }
      if (typeof requestAnimationFrame === 'function') {
        levelRaf = requestAnimationFrame(sampleVisualLevel);
      }
    };
    sampleVisualLevel();
  } catch {}
}

/**
 * Automatically requests Microphone permission on startup using getUserMedia
 * and initializes live WebAudio VAD + Local Moonshine ONNX Speech-to-Text.
 */
export async function requestMicPermission() {
  if (!navigator.mediaDevices?.getUserMedia) {
    update({
      permission: 'unsupported',
      error: 'Microphone access is not available in this browser.',
    });
    return false;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    await unlockAudio();
    flushPendingSpeech();
    setupAudioCaptureGraph(mediaStream);
    void initSTT();
    update({ permission: 'granted', error: null });
    if (mic.autoListen && !mic.pausedForSpeech) {
      startListening();
    }
    return true;
  } catch (err) {
    const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
    update({
      permission: denied ? 'denied' : 'prompt',
      listening: false,
      error: denied
        ? 'Microphone permission blocked — click the Mic button or use the keyboard box.'
        : 'Click the Mic button to allow microphone access.',
    });
    return false;
  }
}

function getSpeechRecognitionCtor() {
  return globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition || null;
}

function ensureRecognition() {
  if (srBroken) return null;
  if (recognition) return recognition;
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.lang = 'en-US';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  rec.onresult = (event) => {
    if (mic.pausedForSpeech) return;
    let interim = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      const text = res[0]?.transcript || '';
      if (res.isFinal) {
        finalTranscript += text;
      } else {
        interim += text;
      }
    }

    if (interim.trim()) {
      update({ interimText: interim.trim() });
    }

    const cleanFinal = finalTranscript.trim();
    if (cleanFinal) {
      lastSrFinalAt = Date.now();
      resetVadBuffer();
      update({ interimText: '' });
      transcriptCallback?.(cleanFinal);
    }
  };

  rec.onerror = (event) => {
    const code = event?.error || '';
    if (code === 'no-speech' || code === 'aborted') return;
    // In Edge, Brave, Chromium, and iframes, webkitSpeechRecognition fails with 'network'.
    // Disable it immediately so our local WebAudio VAD + Moonshine ONNX worker handles all speech cleanly!
    if (code === 'network' || code === 'not-allowed' || code === 'service-not-allowed' || code === 'audio-capture') {
      srBroken = true;
      clearTimeout(restartTimer);
      try {
        rec.stop();
      } catch {}
    }
  };

  rec.onend = () => {
    clearTimeout(restartTimer);
    if (!srBroken && mic.listening && mic.autoListen && !mic.pausedForSpeech && mic.permission === 'granted') {
      restartTimer = setTimeout(() => {
        if (!srBroken && mic.listening && mic.autoListen && !mic.pausedForSpeech) {
          try {
            rec.start();
          } catch {}
        }
      }, 400);
    }
  };

  recognition = rec;
  return rec;
}

export function startListening() {
  void unlockAudio();
  flushPendingSpeech();
  if (mic.permission !== 'granted') {
    void requestMicPermission();
    return;
  }
  update({ listening: true, error: null });
  void initSTT();

  const rec = ensureRecognition();
  if (rec && !srBroken) {
    try {
      rec.start();
    } catch {}
  }
}

export function stopListening({ disableAuto = false } = {}) {
  clearTimeout(restartTimer);
  if (disableAuto) {
    update({ autoListen: false });
  }
  const rec = recognition;
  if (rec) {
    try {
      rec.stop();
    } catch {}
  }

  // If the user was speaking when they released Spacebar or clicked Stop, transcribe the captured VAD buffer immediately!
  if (vadSpeaking && speechSamples >= TARGET_SR * 0.2) {
    update({ listening: false });
    flushVadUtterance();
    return;
  }

  resetVadBuffer();
  if (mic.interimText.trim() && mic.interimText !== 'Hearing you…' && mic.interimText !== 'Transcribing…') {
    const pending = mic.interimText.trim();
    update({ interimText: '', listening: false });
    transcriptCallback?.(pending);
  } else {
    update({ listening: false, interimText: '' });
  }
}

export function toggleListening() {
  if (mic.listening) {
    stopListening({ disableAuto: true });
  } else {
    update({ autoListen: true, pausedForSpeech: false });
    startListening();
  }
}

export function setPausedForSpeech(paused) {
  if (mic.pausedForSpeech === paused) return;
  update({ pausedForSpeech: paused });
  if (paused) {
    clearTimeout(restartTimer);
    resetVadBuffer();
    try {
      recognition?.stop();
    } catch {}
  } else if (mic.autoListen && mic.permission === 'granted') {
    update({ listening: true });
    if (!srBroken) {
      restartTimer = setTimeout(() => {
        if (!mic.pausedForSpeech && mic.autoListen && !srBroken) {
          try {
            ensureRecognition()?.start();
          } catch {}
        }
      }, 250);
    }
  }
}
