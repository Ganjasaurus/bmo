import { ai, subscribeAI, autoBootAI, complete } from './ai.js?v=1';
import {
  speech,
  subscribeSpeech,
  subscribeViseme,
  initVoice,
  speakSentence,
  stopSpeech,
  unlockAudio,
} from './speech.js?v=1';
import { BmoFaceController } from './face.js?v=1';
import { ConversationMemory } from './memory.js?v=1';
import {
  mic,
  subscribeMic,
  onTranscription,
  requestMicPermission,
  startListening,
  stopListening,
  toggleListening,
  setPausedForSpeech,
} from './listening.js?v=1';

const memory = new ConversationMemory();
let face = null;
let spaceDown = false;
let keyboardOpen = false;

const els = {};

function refreshStatusUI() {
  if (!els.status) return;

  const aiReady = ai.status === 'ready';
  const voiceReady = speech.voiceStatus === 'ready';
  const bothReady = aiReady && voiceReady;

  if (els.progressWrap && els.progressBar) {
    if (bothReady) {
      els.progressWrap.hidden = true;
    } else {
      els.progressWrap.hidden = false;
      const combinedProgress = Math.round(((ai.progress || 0) * 0.55 + (speech.voiceProgress || 0) * 0.45) * 100);
      els.progressBar.style.width = `${Math.max(5, Math.min(100, combinedProgress))}%`;
    }
  }

  if (speech.status === 'speaking') {
    els.status.textContent = 'Talking';
    els.statusDot.dataset.state = 'talking';
    if (speech.currentSentence) {
      els.caption.textContent = speech.currentSentence;
    }
    return;
  }

  if (ai.busy) {
    els.status.textContent = 'Thinking…';
    els.statusDot.dataset.state = 'thinking';
    return;
  }

  if (!bothReady) {
    els.statusDot.dataset.state = ai.status === 'error' ? 'error' : 'loading';
    if (ai.status === 'error') {
      els.status.textContent = ai.error || 'AI load error';
    } else if (!voiceReady && !aiReady) {
      els.status.textContent = `${ai.text} · ${speech.voiceText}`;
    } else if (!aiReady) {
      els.status.textContent = ai.text;
    } else {
      els.status.textContent = speech.voiceText;
    }
    return;
  }

  if (mic.listening) {
    els.status.textContent = 'Listening';
    els.statusDot.dataset.state = 'listening';
    if (mic.interimText) {
      els.caption.textContent = `"${mic.interimText}…"`;
    }
  } else {
    els.status.textContent = 'Idle';
    els.statusDot.dataset.state = 'idle';
  }
}

function refreshMicUI() {
  if (!els.micBtn) return;
  els.micBtn.classList.toggle('is-listening', mic.listening);
  if (els.micLabel) {
    if (mic.permission === 'denied') {
      els.micLabel.textContent = 'Mic Blocked';
    } else if (mic.listening) {
      els.micLabel.textContent = 'Listening';
    } else {
      els.micLabel.textContent = 'Talk';
    }
  }
  if (els.micRing) {
    if (mic.listening && mic.level > 0.04) {
      els.micRing.style.opacity = String(Math.min(0.95, 0.25 + mic.level));
      els.micRing.style.transform = `scale(${(1 + mic.level * 0.18).toFixed(2)})`;
    } else {
      els.micRing.style.opacity = '0';
      els.micRing.style.transform = 'scale(1)';
    }
  }
}

export async function submitUserPrompt(rawText) {
  const prompt = String(rawText || '').trim();
  if (!prompt) return;

  void unlockAudio();
  stopSpeech();

  if (els.caption) {
    els.caption.textContent = `You: "${prompt}"`;
  }

  // If Qwen 0.5B hasn't finished loading yet, BMO still answers immediately with its ONNX voice & visemes!
  if (ai.status !== 'ready') {
    const warmupLine =
      'Hi friend! I am BMO! My Qwen brain is almost done warming up, keep talking to me!';
    if (els.caption) els.caption.textContent = warmupLine;
    await speakSentence(warmupLine);
    return;
  }

  memory.addUser(prompt);
  const messages = memory.snapshot();

  try {
    let spokenAny = false;
    const reply = await complete(messages, {
      temperature: 0.7,
      max_tokens: 110,
      onToken: (partial) => {
        if (els.caption && speech.status !== 'speaking') {
          els.caption.textContent = partial;
        }
      },
      onSentence: (sentence) => {
        spokenAny = true;
        void speakSentence(sentence);
      },
    });

    memory.addAssistant(reply);
    if (els.caption) {
      els.caption.textContent = reply;
    }
    if (!spokenAny && reply) {
      await speakSentence(reply);
    }
  } catch (err) {
    if (err?.name !== 'AbortError') {
      const fallback = "Oh! My circuits tickled for a second. Say that again, friend!";
      if (els.caption) els.caption.textContent = fallback;
      await speakSentence(fallback);
    }
  }
}

function toggleKeyboardBox(forceOpen) {
  keyboardOpen = typeof forceOpen === 'boolean' ? forceOpen : !keyboardOpen;
  if (els.keyboardBox) {
    els.keyboardBox.hidden = !keyboardOpen;
  }
  if (els.kbdBtn) {
    els.kbdBtn.setAttribute('aria-expanded', String(keyboardOpen));
  }
  if (keyboardOpen && els.promptInput) {
    els.promptInput.focus();
  }
}

async function initApp() {
  els.canvas = document.getElementById('bmo-face-canvas');
  els.faceFrame = document.getElementById('bmo-face-frame');
  els.status = document.getElementById('bmo-status');
  els.statusDot = document.getElementById('bmo-status-dot');
  els.progressWrap = document.getElementById('bmo-progress-wrap');
  els.progressBar = document.getElementById('bmo-progress-bar');
  els.caption = document.getElementById('bmo-caption');
  els.micBtn = document.getElementById('btn-mic');
  els.micLabel = document.getElementById('btn-mic-label');
  els.micRing = document.getElementById('mic-ring');
  els.kbdBtn = document.getElementById('btn-keyboard');
  els.keyboardBox = document.getElementById('keyboard-box');
  els.promptInput = document.getElementById('prompt-input');

  face = new BmoFaceController(els.canvas);
  await face.loadSprites('./assets/face');

  // Wire Piper viseme events directly to BMO's face canvas
  subscribeViseme((visemeName) => {
    face.setFace(visemeName);
  });

  // Pause mic recognition while BMO is speaking so BMO doesn't transcribe itself
  subscribeSpeech((s) => {
    setPausedForSpeech(s.status === 'speaking');
    refreshStatusUI();
  });

  subscribeAI(() => {
    refreshStatusUI();
  });

  subscribeMic(() => {
    refreshMicUI();
    refreshStatusUI();
  });

  onTranscription((spokenText) => {
    void submitUserPrompt(spokenText);
  });

  // Unlock WebAudio on any interaction
  const unlock = () => void unlockAudio();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });

  els.faceFrame?.addEventListener('click', () => {
    void unlockAudio();
    face.blink();
  });

  els.micBtn?.addEventListener('click', () => {
    void unlockAudio();
    toggleListening();
  });

  els.kbdBtn?.addEventListener('click', () => {
    void unlockAudio();
    toggleKeyboardBox();
  });

  els.keyboardBox?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = els.promptInput?.value?.trim() || '';
    if (text) {
      els.promptInput.value = '';
      void submitUserPrompt(text);
    }
  });

  // Push-to-talk with Spacebar (just like original desktop BMO!) when not typing in text box
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && keyboardOpen) {
      toggleKeyboardBox(false);
      return;
    }
    if (e.code === 'Space' && document.activeElement !== els.promptInput && !spaceDown) {
      e.preventDefault();
      spaceDown = true;
      void unlockAudio();
      startListening();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && spaceDown) {
      e.preventDefault();
      spaceDown = false;
      stopListening();
    }
  });

  // Expose window.bmo for easy inspection & automated verification
  window.bmo = {
    face,
    ai,
    speech,
    mic,
    memory,
    submitUserPrompt,
    speakSentence,
    toggleKeyboardBox,
  };

  // Auto-load Qwen 0.5B, BMO Piper ONNX Voice, and request Microphone permission in parallel!
  void Promise.all([
    initVoice(),
    autoBootAI(),
    requestMicPermission(),
  ]);
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initApp);
} else {
  void initApp();
}
