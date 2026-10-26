import { unlockAudio, getAudioContext } from './speech.js?v=1';

export const mic = {
  permission: 'prompt', // 'prompt' | 'granted' | 'denied' | 'unsupported'
  listening: false,
  autoListen: true,
  pausedForSpeech: false,
  level: 0,
  interimText: '',
  error: null,
};

const listeners = new Set();
let transcriptCallback = null;
let mediaStream = null;
let recognition = null;
let analyser = null;
let levelRaf = null;
let restartTimer = null;

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

function startLevelMeter(stream) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const source = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const sampleLevel = () => {
      if (!analyser) return;
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / (data.length * 255);
      const level = Math.min(1, Number((avg * 2.8).toFixed(2)));
      if (Math.abs(level - mic.level) > 0.03) {
        update({ level });
      }
      if (typeof requestAnimationFrame === 'function') {
        levelRaf = requestAnimationFrame(sampleLevel);
      }
    };
    sampleLevel();
  } catch {}
}

/**
 * Automatically requests Microphone permission on startup using getUserMedia
 * and initializes live voice recognition.
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
      },
    });
    void unlockAudio();
    startLevelMeter(mediaStream);
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
  if (recognition) return recognition;
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.lang = 'en-US';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  rec.onstart = () => {
    update({ listening: true, error: null });
  };

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

    update({ interimText: interim.trim() });

    const cleanFinal = finalTranscript.trim();
    if (cleanFinal) {
      update({ interimText: '' });
      transcriptCallback?.(cleanFinal);
    }
  };

  rec.onerror = (event) => {
    const code = event?.error || '';
    if (code === 'no-speech' || code === 'aborted') return;
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      update({
        listening: false,
        autoListen: false,
        error: 'Speech recognition blocked — use the keyboard button to type.',
      });
    }
  };

  rec.onend = () => {
    update({ listening: false });
    clearTimeout(restartTimer);
    if (mic.autoListen && !mic.pausedForSpeech && mic.permission === 'granted') {
      restartTimer = setTimeout(() => {
        if (mic.autoListen && !mic.pausedForSpeech) {
          try {
            rec.start();
          } catch {}
        }
      }, 280);
    }
  };

  recognition = rec;
  return rec;
}

export function startListening() {
  void unlockAudio();
  if (mic.permission !== 'granted') {
    void requestMicPermission();
    return;
  }
  const rec = ensureRecognition();
  if (!rec) {
    update({
      listening: true,
      error: null,
    });
    return;
  }
  try {
    rec.start();
    update({ listening: true, error: null });
  } catch {
    update({ listening: true });
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
  if (mic.interimText.trim()) {
    const pending = mic.interimText.trim();
    update({ interimText: '', listening: false });
    transcriptCallback?.(pending);
  } else {
    update({ listening: false });
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
  update({ pausedForSpeech: paused, interimText: '' });
  if (paused) {
    clearTimeout(restartTimer);
    try {
      recognition?.stop();
    } catch {}
  } else if (mic.autoListen && mic.permission === 'granted') {
    restartTimer = setTimeout(() => {
      if (!mic.pausedForSpeech && mic.autoListen) {
        startListening();
      }
    }, 220);
  }
}
