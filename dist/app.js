import { ai, subscribeAI, autoBootAI, complete } from './ai.js?v=9';
import {
  speech,
  subscribeSpeech,
  subscribeViseme,
  initVoice,
  speakSentence,
  stopSpeech,
  unlockAudio,
  flushPendingSpeech,
} from './speech.js?v=9';
import { BmoFaceController } from './face.js?v=9';
import { FACE_NAMES } from './visemes.js?v=9';
import { ConversationMemory, BMO_PERSONALITY, MAX_HISTORY } from './memory.js?v=9';
import {
  mic,
  subscribeMic,
  onTranscription,
  requestMicPermission,
  initSTT,
  transcribeAudioFloat32,
  startListening,
  stopListening,
  toggleListening,
  setPausedForSpeech,
} from './listening.js?v=9';
import {
  IMAGE_PRESETS,
  detectImageRequest,
  generateLocalArtwork,
  loadSavedGallery,
  saveToGallery,
} from './image-gen.js?v=9';

const memory = new ConversationMemory(BMO_PERSONALITY, MAX_HISTORY, { persist: true });
let face = null;
let spaceDown = false;
let keyboardOpen = false;
let imageStudioOpen = false;
let greetedOnVoiceReady = false;
let greetedOnAiReady = false;
let lastGeneratedImage = null;
let imageGenerating = false;

const els = {};

function renderHistoryStrip() {
  if (!els.historyStrip) return;
  const turns = memory.historyTurns().slice(-6);
  if (!turns.length) {
    els.historyStrip.hidden = true;
    els.historyStrip.innerHTML = '';
    return;
  }
  els.historyStrip.hidden = false;
  els.historyStrip.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'bmo-history-header';
  const title = document.createElement('span');
  title.textContent = `Recent Chat (${turns.length})`;
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'bmo-history-clear';
  clearBtn.textContent = 'Clear';
  clearBtn.title = 'Clear conversation history';
  clearBtn.addEventListener('click', () => {
    memory.clear();
    renderHistoryStrip();
  });
  header.appendChild(title);
  header.appendChild(clearBtn);
  els.historyStrip.appendChild(header);

  for (const t of turns) {
    const row = document.createElement('div');
    row.className = 'bmo-history-item';
    row.title = t.role === 'assistant' ? 'Click to hear BMO say this again' : t.content;
    const who = document.createElement('strong');
    who.textContent = t.role === 'user' ? 'You: ' : 'BMO: ';
    row.appendChild(who);
    row.appendChild(document.createTextNode(t.content));
    if (t.role === 'assistant') {
      row.addEventListener('click', () => {
        void unlockAudio();
        if (els.caption) els.caption.textContent = t.content;
        void speakSentence(t.content);
      });
    }
    els.historyStrip.appendChild(row);
  }
  els.historyStrip.scrollTop = els.historyStrip.scrollHeight;
}

function buildWarmupReply(promptText) {
  const lower = String(promptText || '').toLowerCase();
  const pct = Math.max(1, Math.min(99, Math.round((ai.progress || 0.1) * 100)));

  if (/\b(hi|hello|hey|yo|sup|howdy|greetings)\b/.test(lower)) {
    return `Hello friend! I am BMO! I can hear you loud and clear! My Qwen brain is ${pct} percent loaded!`;
  }
  if (/\b(how are you|how's it going|how do you feel)\b/.test(lower)) {
    return `I am feeling super mathematical today! My voice is working great, and my Qwen brain is ${pct} percent ready!`;
  }
  if (/\b(who are you|what is your name|your name)\b/.test(lower)) {
    return `I am BMO, your living video game console and best friend! My Qwen brain is ${pct} percent loaded!`;
  }
  if (/\b(joke|funny|laugh)\b/.test(lower)) {
    return `Why did the robot eat a lightbulb? Because it wanted a light snack! Hehe! My Qwen brain is at ${pct} percent!`;
  }
  if (/\b(sing|song|music)\b/.test(lower)) {
    return `Beep boop beep! BMO loves singing little computer songs with you! My Qwen brain is ${pct} percent ready!`;
  }
  return `I heard you say: "${promptText}"! My Qwen brain is ${pct} percent finished loading, keep talking to me friend!`;
}

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
      const combinedProgress = Math.round(((speech.voiceProgress || 0) * 0.45 + (ai.progress || 0) * 0.55) * 100);
      els.progressBar.style.width = `${Math.max(5, Math.min(100, combinedProgress))}%`;
    }
  }

  if (speech.status === 'speaking') {
    face?.setMood('talking');
    els.status.textContent = speech.autoplayBlocked ? 'Tap BMO to unmute voice' : 'Talking';
    els.statusDot.dataset.state = 'talking';
    if (speech.currentSentence) {
      els.caption.textContent = speech.currentSentence;
    }
    return;
  }

  if (speech.autoplayBlocked) {
    els.status.textContent = 'Tap BMO to hear voice';
    els.statusDot.dataset.state = 'talking';
    return;
  }

  if (mic.transcribing) {
    face?.setMood('thinking');
    els.status.textContent = 'Transcribing…';
    els.statusDot.dataset.state = 'thinking';
    return;
  }

  if (mic.vadActive) {
    face?.setMood('listening');
    els.status.textContent = 'Hearing you…';
    els.statusDot.dataset.state = 'listening';
    return;
  }

  if (ai.busy) {
    face?.setMood('thinking');
    els.status.textContent = 'Thinking…';
    els.statusDot.dataset.state = 'thinking';
    return;
  }

  face?.setMood('happy');

  if (!bothReady) {
    els.statusDot.dataset.state = ai.status === 'error' ? 'error' : 'loading';
    if (ai.status === 'error') {
      els.status.textContent = ai.error || 'AI load error';
    } else if (!voiceReady) {
      els.status.textContent = speech.voiceText;
    } else {
      els.status.textContent = `BMO Voice Ready · ${ai.text}`;
    }
    return;
  }

  if (mic.listening) {
    els.status.textContent = 'Listening';
    els.statusDot.dataset.state = 'listening';
    if (mic.interimText && mic.interimText !== 'Hearing you…' && mic.interimText !== 'Transcribing…') {
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
    } else if (mic.transcribing) {
      els.micLabel.textContent = 'Thinking…';
    } else if (mic.vadActive) {
      els.micLabel.textContent = 'Hearing…';
    } else if (mic.listening) {
      els.micLabel.textContent = 'Listening';
    } else {
      els.micLabel.textContent = 'Talk';
    }
  }
  if (els.micRing) {
    if (mic.listening && (mic.level > 0.02 || mic.vadActive)) {
      const lvl = mic.vadActive ? Math.max(0.35, mic.level) : mic.level;
      els.micRing.style.opacity = String(Math.min(0.95, 0.25 + lvl));
      els.micRing.style.transform = `scale(${(1 + lvl * 0.22).toFixed(2)})`;
    } else {
      els.micRing.style.opacity = '0';
      els.micRing.style.transform = 'scale(1)';
    }
  }
}

export function renderGalleryStrip() {
  if (!els.imageGalleryStrip) return;
  const items = loadSavedGallery();
  if (!items.length) {
    els.imageGalleryStrip.hidden = true;
    els.imageGalleryStrip.innerHTML = '';
    return;
  }
  els.imageGalleryStrip.hidden = false;
  els.imageGalleryStrip.innerHTML = '';
  for (const item of items) {
    if (!item.dataUrl) continue;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bmo-gallery-thumb';
    btn.title = `${item.prompt} (${item.styleId})`;
    const img = document.createElement('img');
    img.src = item.dataUrl;
    img.alt = item.prompt || 'BMO artwork';
    btn.appendChild(img);
    btn.addEventListener('click', () => {
      if (els.imagePromptInput) els.imagePromptInput.value = item.prompt || '';
      if (els.imageStyleSelect && item.styleId) els.imageStyleSelect.value = item.styleId;
      void runImageGeneration(item.prompt, item.styleId);
    });
    els.imageGalleryStrip.appendChild(btn);
  }
}

export async function runImageGeneration(promptText, styleId) {
  const chosenStyle = styleId || els.imageStyleSelect?.value || 'anime';
  const cleanPrompt = String(promptText || els.imagePromptInput?.value || 'BMO in an emerald forest at sunset').trim();
  if (els.imagePromptInput) els.imagePromptInput.value = cleanPrompt;
  if (els.imageStyleSelect && styleId) els.imageStyleSelect.value = styleId;
  toggleImageStudio(true, { skipAutoGenerate: true });
  imageGenerating = true;

  try {
    const result = await generateLocalArtwork(els.imageCanvas, cleanPrompt, {
      styleId: chosenStyle,
      onStep: ({ step, totalSteps, label }) => {
        if (els.imgStepStatus) {
          els.imgStepStatus.textContent = `Step ${step}/${totalSteps} · ${label}`;
        }
      },
    });

    if (result) {
      lastGeneratedImage = result;
      saveToGallery(result);
      renderGalleryStrip();
      if (els.imgStepStatus) {
        els.imgStepStatus.textContent = `Painted (${chosenStyle})`;
      }
    }
    return result;
  } finally {
    imageGenerating = false;
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

  // Check if the user asked BMO to draw/paint/generate an image!
  const imageSubject = detectImageRequest(prompt);
  if (imageSubject) {
    const artReply = `Ooh! I love painting! Watch me paint ${imageSubject} for you right now!`;
    memory.addUser(prompt);
    memory.addAssistant(artReply);
    renderHistoryStrip();
    if (els.caption) els.caption.textContent = artReply;
    void runImageGeneration(imageSubject);
    await speakSentence(artReply);
    return;
  }

  // If Qwen 0.5B hasn't finished downloading yet, BMO still responds conversationally with its ONNX voice & visemes!
  if (ai.status !== 'ready') {
    const warmupLine = buildWarmupReply(prompt);
    memory.addUser(prompt);
    memory.addAssistant(warmupLine);
    renderHistoryStrip();
    if (els.caption) els.caption.textContent = warmupLine;
    await speakSentence(warmupLine);
    return;
  }

  memory.addUser(prompt);
  renderHistoryStrip();
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
    renderHistoryStrip();
    if (els.caption) {
      els.caption.textContent = reply;
    }
    if (!spokenAny && reply) {
      await speakSentence(reply);
    }
  } catch (err) {
    if (err?.name !== 'AbortError') {
      const fallback = 'Oh! My circuits tickled for a second. Say that again, friend!';
      if (els.caption) els.caption.textContent = fallback;
      await speakSentence(fallback);
    }
  }
}

export function toggleKeyboardBox(forceOpen) {
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

export function toggleImageStudio(forceOpen, { skipAutoGenerate = false } = {}) {
  imageStudioOpen = typeof forceOpen === 'boolean' ? forceOpen : !imageStudioOpen;
  if (els.imageStudio) {
    els.imageStudio.hidden = !imageStudioOpen;
  }
  if (els.imgBtn) {
    els.imgBtn.setAttribute('aria-expanded', String(imageStudioOpen));
  }
  if (imageStudioOpen && !lastGeneratedImage && !imageGenerating && !skipAutoGenerate) {
    void runImageGeneration(els.imagePromptInput?.value || 'BMO in a glowing emerald forest at sunset');
  }
}

async function bootModelsAndGreet() {
  // 1. Prioritize BMO's 63 MB Piper ONNX voice + Microphone permission first so BMO speaks within seconds!
  void requestMicPermission();
  const voiceOk = await initVoice();

  if (voiceOk && !greetedOnVoiceReady) {
    greetedOnVoiceReady = true;
    const greeting = 'Hi friend! I am BMO! Say hello, or tap the keyboard button to chat!';
    if (els.caption) els.caption.textContent = greeting;
    void speakSentence(greeting);
  }

  // 2. Boot Local Moonshine ONNX Speech-to-Text ear and Qwen 2.5 0.5B LLM brain
  void initSTT();
  const aiOk = await autoBootAI();

  if (aiOk && !greetedOnAiReady) {
    greetedOnAiReady = true;
    if (speech.status === 'idle' && !mic.vadActive && !mic.transcribing) {
      const readyLine = 'Yay! My Qwen brain is ready! Ask me anything!';
      if (els.caption) els.caption.textContent = readyLine;
      void speakSentence(readyLine);
    }
  }
}

async function initApp() {
  els.canvas = document.getElementById('bmo-face-canvas');
  els.faceFrame = document.getElementById('bmo-face-frame');
  els.visemeBadge = document.getElementById('bmo-viseme-badge');
  els.visemeStrip = document.getElementById('bmo-viseme-strip');
  els.status = document.getElementById('bmo-status');
  els.statusDot = document.getElementById('bmo-status-dot');
  els.progressWrap = document.getElementById('bmo-progress-wrap');
  els.progressBar = document.getElementById('bmo-progress-bar');
  els.caption = document.getElementById('bmo-caption');
  els.historyStrip = document.getElementById('bmo-history-strip');
  els.micBtn = document.getElementById('btn-mic');
  els.micLabel = document.getElementById('btn-mic-label');
  els.micRing = document.getElementById('mic-ring');
  els.kbdBtn = document.getElementById('btn-keyboard');
  els.keyboardBox = document.getElementById('keyboard-box');
  els.promptInput = document.getElementById('prompt-input');

  els.imgBtn = document.getElementById('btn-image');
  els.imageStudio = document.getElementById('image-studio');
  els.imgCloseBtn = document.getElementById('btn-img-close');
  els.imageCanvas = document.getElementById('bmo-image-canvas');
  els.imageForm = document.getElementById('image-form');
  els.imagePromptInput = document.getElementById('image-prompt-input');
  els.imageStyleSelect = document.getElementById('image-style-select');
  els.imgDownloadBtn = document.getElementById('btn-img-download');
  els.imgStepStatus = document.getElementById('img-step-status');
  els.imagePresetChips = document.getElementById('image-preset-chips');
  els.imageGalleryStrip = document.getElementById('image-gallery-strip');

  // Render saved conversation history & image gallery immediately (<2ms)
  renderHistoryStrip();
  renderGalleryStrip();

  if (els.imagePresetChips) {
    els.imagePresetChips.innerHTML = '';
    for (const preset of IMAGE_PRESETS) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'bmo-preset-chip';
      chip.textContent = preset.label;
      chip.addEventListener('click', () => {
        if (els.imagePromptInput) els.imagePromptInput.value = preset.prompt;
        if (els.imageStyleSelect) els.imageStyleSelect.value = preset.styleId;
        void runImageGeneration(preset.prompt, preset.styleId);
      });
      els.imagePresetChips.appendChild(chip);
    }
  }

  face = new BmoFaceController(els.canvas);
  await face.loadSprites('./assets/face');

  // Wire Piper viseme events directly to BMO's anime face canvas & badge
  subscribeViseme((visemeName) => {
    face.setFace(visemeName);
    if (els.visemeBadge) {
      els.visemeBadge.textContent = visemeName;
    }
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

  // Unlock WebAudio & flush any autoplay-deferred greeting on any interaction
  const unlock = () => {
    void unlockAudio();
    flushPendingSpeech();
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });

  // Populate 12-viseme interactive audition strip
  if (els.visemeStrip) {
    els.visemeStrip.innerHTML = '';
    for (const vName of FACE_NAMES) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bmo-viseme-pill';
      btn.textContent = vName;
      btn.dataset.viseme = vName;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        face.setFace(vName);
        face.snapToTargetViseme();
        for (const child of els.visemeStrip.children) {
          child.dataset.active = String(child.dataset.viseme === vName);
        }
      });
      els.visemeStrip.appendChild(btn);
    }
  }

  els.visemeBadge?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!els.visemeStrip) return;
    const nextOpen = els.visemeStrip.hidden;
    els.visemeStrip.hidden = !nextOpen;
    els.visemeBadge.setAttribute('aria-expanded', String(nextOpen));
  });

  els.faceFrame?.addEventListener('click', () => {
    void unlockAudio();
    const hadBlocked = speech.autoplayBlocked;
    flushPendingSpeech();
    face.blink();
    if (!hadBlocked && speech.voiceStatus === 'ready' && speech.status === 'idle' && !ai.busy) {
      const tickleLine = 'Hehe! That tickles! Talk to me anytime, friend!';
      if (els.caption) els.caption.textContent = tickleLine;
      void speakSentence(tickleLine);
    }
  });

  els.micBtn?.addEventListener('click', () => {
    void unlockAudio();
    flushPendingSpeech();
    toggleListening();
  });

  els.kbdBtn?.addEventListener('click', () => {
    void unlockAudio();
    flushPendingSpeech();
    toggleKeyboardBox();
  });

  els.imgBtn?.addEventListener('click', () => {
    void unlockAudio();
    flushPendingSpeech();
    toggleImageStudio();
  });

  els.imgCloseBtn?.addEventListener('click', () => {
    toggleImageStudio(false);
  });

  els.imageForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    void runImageGeneration(els.imagePromptInput?.value, els.imageStyleSelect?.value);
  });

  els.imgDownloadBtn?.addEventListener('click', () => {
    if (!els.imageCanvas) return;
    const link = document.createElement('a');
    link.download = `bmo-art-${Date.now()}.png`;
    link.href = els.imageCanvas.toDataURL('image/png');
    link.click();
  });

  els.keyboardBox?.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = els.promptInput?.value?.trim() || '';
    if (text) {
      els.promptInput.value = '';
      void submitUserPrompt(text);
    }
  });

  // Push-to-talk with Spacebar when not typing in an input box
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (keyboardOpen) toggleKeyboardBox(false);
      if (imageStudioOpen) toggleImageStudio(false);
      return;
    }
    const active = document.activeElement;
    const isTyping = active === els.promptInput || active === els.imagePromptInput;
    if (e.code === 'Space' && !isTyping && !spaceDown) {
      e.preventDefault();
      spaceDown = true;
      void unlockAudio();
      flushPendingSpeech();
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
    transcribeAudioFloat32,
    toggleKeyboardBox,
    toggleImageStudio,
    runImageGeneration,
  };
  window.__BMO_DEBUG = window.bmo;

  void bootModelsAndGreet();
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initApp);
} else {
  void initApp();
}
