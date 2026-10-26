// Exact port of H:\AI\scripts\visemes.py & H:\AI\scripts\core\brain.py

export const FACE_NAMES = [
  'Neutral',
  'A',
  'D',
  'E',
  'F',
  'L',
  'M',
  'Oh',
  'R',
  'S',
  'Uh',
  'Woo',
];

export const VISEME_MAP = {
  // Open / A
  'ɑ': 'A',
  'ɑː': 'A',
  'a': 'A',
  'æ': 'A',
  'ɒ': 'Oh',

  // E
  'ɛ': 'E',
  'e': 'E',
  'eɪ': 'E',
  'ɪ': 'E',
  'i': 'E',
  'iː': 'E',

  // UH
  'ə': 'Uh',
  'ʌ': 'Uh',
  'ɐ': 'Uh',

  // OH
  'ɔ': 'Oh',
  'o': 'Oh',
  'oʊ': 'Oh',
  'ʊ': 'Oh',

  // WOO
  'u': 'Woo',
  'uː': 'Woo',
  'w': 'Woo',

  // M
  'm': 'M',
  'b': 'M',
  'p': 'M',

  // F
  'f': 'F',
  'v': 'F',
  'θ': 'F',
  'ð': 'F',

  // L
  'l': 'L',

  // R
  'ɹ': 'R',
  'r': 'R',

  // S
  's': 'S',
  'z': 'S',
  'ʃ': 'S',
  'ʒ': 'S',

  // D / tongue
  'd': 'D',
  't': 'D',
  'n': 'D',
  'ŋ': 'D',

  // H
  'h': 'Uh',

  // Y
  'j': 'E',

  // K / G
  'k': 'A',
  'g': 'A',
  'ɡ': 'A',
};

export const IGNORE_PHONEMES = new Set([
  'ˈ', // primary stress
  'ˌ', // secondary stress
  'ː', // long vowel marker
  'ʲ', // palatalization
]);

export function phonemeToViseme(phoneme, lastViseme = 'Neutral') {
  if (IGNORE_PHONEMES.has(phoneme)) {
    return lastViseme;
  }
  if (phoneme === ' ') {
    return 'Neutral';
  }
  return VISEME_MAP[phoneme] || 'Neutral';
}

/**
 * Splits streaming text buffer into completed sentences on '.', '!', '?'
 * Exact port of extract_sentences(buffer) from H:\AI\scripts\core\brain.py
 */
export function extractSentences(buffer) {
  const sentences = [];
  let rest = String(buffer || '');
  while (true) {
    const positions = ['.', '!', '?']
      .map((mark) => rest.indexOf(mark))
      .filter((pos) => pos !== -1);
    if (!positions.length) break;
    const end = Math.min(...positions);
    const sentence = rest.slice(0, end + 1).trim();
    if (sentence) {
      sentences.push(sentence);
    }
    rest = rest.slice(end + 1);
  }
  return { sentences, buffer: rest };
}

/**
 * Converts text into sentence arrays of NFD phoneme codepoints using eSpeak-NG synthesize_ipa,
 * matching Python PiperVoice.phonemize() bit-for-bit.
 */
export function phonemizeClauseText(text, synthesizeIpaFn) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  const clauseRe = /([^,.:;!?]+?)([,.:;!?]+|\s*$)/g;
  const sentences = [];
  let current = [];
  let match;
  while ((match = clauseRe.exec(raw)) !== null) {
    const phrase = match[1].trim();
    const punct = (match[2] || '').trim();
    if (!phrase) continue;
    const ipaResult = synthesizeIpaFn(phrase);
    const ipa = typeof ipaResult === 'string' ? ipaResult : ipaResult?.ipa || '';
    let cleaned = ipa
      .replace(/\([^)]+\)/g, '')
      .replace(/_/g, '')
      .replace(/\r?\n/g, ' ')
      .trim();
    const term = punct ? punct[0] : '';
    cleaned += term;
    if (term === ',' || term === ':' || term === ';') {
      cleaned += ' ';
    }
    for (const ch of cleaned.normalize('NFD')) {
      current.push(ch);
    }
    if (!term || term === '.' || term === '!' || term === '?') {
      if (current.length) sentences.push(current);
      current = [];
    }
  }
  if (current.length) {
    sentences.push(current);
  }
  return sentences;
}

/**
 * Converts a phoneme codepoint array into Piper VITS phoneme IDs (`^` = 1, `_` = 0, `$` = 2).
 * Exact port of piper.voice.phonemes_to_ids().
 */
export function phonemesToIds(phonemes, phonemeIdMap) {
  const ids = [];
  const bos = phonemeIdMap['^'] || [1];
  const pad = phonemeIdMap['_'] || [0];
  const eos = phonemeIdMap['$'] || [2];
  ids.push(...bos, ...pad);
  for (const phoneme of phonemes) {
    const mapped = phonemeIdMap[phoneme];
    if (!mapped) continue;
    ids.push(...mapped, ...pad);
  }
  ids.push(...eos);
  return ids;
}

/**
 * Builds the viseme timeline from Piper VITS phoneme IDs and `/Ceil_output_0` frame alignments.
 * Exact port of build_timeline() from H:\AI\scripts\visemes.py, with contiguous pad duration merging.
 */
export function buildTimeline(phonemes, phonemeIds, alignments, sampleRate = 16000) {
  const timeline = [];
  let currentTime = 0.0;
  let phonemeIndex = 0;
  let lastViseme = 'Neutral';

  const count = Math.min(phonemeIds.length, alignments.length);
  for (let i = 0; i < count; i++) {
    const phonemeId = Number(phonemeIds[i]);
    const sampleCount = Number(alignments[i]);
    const duration = sampleCount / sampleRate;

    // ID 0 is pad ('_'), ID 1 is BOS ('^'), ID 2 is EOS ('$').
    if (phonemeId === 0 || phonemeId === 1 || phonemeId === 2) {
      if (phonemeId === 0 && timeline.length > 0) {
        // Extend the active phoneme through its trailing pad so mouth transitions are gapless
        timeline[timeline.length - 1].end = currentTime + duration;
      }
      currentTime += duration;
      continue;
    }

    if (phonemeIndex >= phonemes.length) {
      currentTime += duration;
      continue;
    }

    const phoneme = phonemes[phonemeIndex++];
    const viseme = phonemeToViseme(phoneme, lastViseme);

    timeline.push({
      start: currentTime,
      end: currentTime + duration,
      phoneme,
      viseme,
    });

    currentTime += duration;
    if (viseme !== 'Neutral') {
      lastViseme = viseme;
    }
  }

  return timeline;
}

/**
 * Finds the active viseme mouth sprite name at `elapsedSec` seconds into audio playback.
 */
export function visemeAtTime(timeline, elapsedSec) {
  if (!Array.isArray(timeline) || !timeline.length || elapsedSec < 0) {
    return 'Neutral';
  }
  for (let i = 0; i < timeline.length; i++) {
    const item = timeline[i];
    if (elapsedSec < item.end) {
      return elapsedSec >= item.start ? item.viseme : 'Neutral';
    }
  }
  return 'Neutral';
}

/**
 * Generates a realistic character-to-viseme timeline when fallback audio synthesis is used.
 */
export function buildFallbackTimeline(text, durationSec) {
  const chars = Array.from(String(text || '').toLowerCase());
  if (!chars.length || !(durationSec > 0)) return [];
  const step = durationSec / chars.length;
  const timeline = [];
  let t = 0;
  let lastViseme = 'Neutral';
  const charMap = {
    a: 'A', e: 'E', i: 'E', o: 'Oh', u: 'Uh', y: 'E',
    w: 'Woo', m: 'M', b: 'M', p: 'M',
    f: 'F', v: 'F', l: 'L', r: 'R',
    s: 'S', z: 'S', c: 'S',
    d: 'D', t: 'D', n: 'D',
    h: 'Uh', k: 'A', g: 'A',
  };
  for (const ch of chars) {
    let viseme = 'Neutral';
    if (/[a-z]/.test(ch)) {
      viseme = charMap[ch] || lastViseme || 'Uh';
    }
    timeline.push({
      start: t,
      end: t + step,
      phoneme: ch,
      viseme,
    });
    t += step;
    if (viseme !== 'Neutral') lastViseme = viseme;
  }
  return timeline;
}
