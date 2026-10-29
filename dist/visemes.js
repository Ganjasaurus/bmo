// Viseme & Streaming Sentence Chunker Engine for BMO Web App
// Upgraded from H:\AI\scripts\visemes.py & H:\AI\scripts\core\brain.py with full IPA coverage
// and smart streaming sentence/lyric/abbreviation splitting.

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
  // Open / A (open vowels + velar/uvular/glottal-open dorsals)
  'ɑ': 'A',
  'ɑː': 'A',
  'a': 'A',
  'æ': 'A',
  'ɶ': 'A',
  'k': 'A',
  'g': 'A',
  'ɡ': 'A',
  'c': 'A',
  'ɟ': 'A',
  'q': 'A',
  'ɢ': 'A',
  'ɣ': 'A',
  'χ': 'A',
  'ʁ': 'A',
  'x': 'A',

  // Wide Smile / E (close-front vowels + palatal glides + eSpeak reduced ᵻ)
  'ɛ': 'E',
  'e': 'E',
  'eɪ': 'E',
  'ɪ': 'E',
  'i': 'E',
  'iː': 'E',
  'ᵻ': 'E',
  'ɨ': 'E',
  'ɘ': 'E',
  'j': 'E',
  'ʝ': 'E',

  // Mid Central / Uh (schwa, strut, RP NURSE vowel ɜ, aspirates)
  'ə': 'Uh',
  'ʌ': 'Uh',
  'ɐ': 'Uh',
  'ɜ': 'Uh',
  'ɝ': 'Uh',
  'h': 'Uh',
  'ɦ': 'Uh',
  'ħ': 'Uh',
  'ʜ': 'Uh',

  // Rounded / Oh
  'ɒ': 'Oh',
  'ɔ': 'Oh',
  'o': 'Oh',
  'oʊ': 'Oh',
  'ʊ': 'Oh',
  'ø': 'Oh',
  'œ': 'Oh',
  'ɵ': 'Oh',
  'ɤ': 'Oh',
  'ɞ': 'Oh',

  // Puckered / Woo (close rounded vowels + labial-velar glides, incl. modern RP ʉ)
  'u': 'Woo',
  'uː': 'Woo',
  'ʉ': 'Woo',
  'ɯ': 'Woo',
  'ʏ': 'Woo',
  'y': 'Woo',
  'ɥ': 'Woo',
  'w': 'Woo',
  'ʍ': 'Woo',

  // Bilabial Closed / M
  'm': 'M',
  'b': 'M',
  'p': 'M',
  'ɓ': 'M',
  'ʙ': 'M',

  // Labiodental / Dental Lip-Bite / F
  'f': 'F',
  'v': 'F',
  'θ': 'F',
  'ð': 'F',
  'ɱ': 'F',
  'ʋ': 'F',
  'ɸ': 'F',
  'β': 'F',
  'ⱱ': 'F',

  // Alveolar Lateral Tongue-Tip / L (including dark L ɫ)
  'l': 'L',
  'ɫ': 'L',
  'ʟ': 'L',
  'ʎ': 'L',
  'ɭ': 'L',
  'ɺ': 'L',
  'ɬ': 'L',
  'ɮ': 'L',

  // Rhotic / R (including r-colored vowel hook ˞ & ɚ)
  'ɹ': 'R',
  'r': 'R',
  'ɚ': 'R',
  '˞': 'R',
  'ɻ': 'R',
  'ɽ': 'R',
  'ʀ': 'R',

  // Sibilant Clenched Teeth / S
  's': 'S',
  'z': 'S',
  'ʃ': 'S',
  'ʒ': 'S',
  'ɕ': 'S',
  'ʑ': 'S',
  'ʂ': 'S',
  'ʐ': 'S',
  'ç': 'S',

  // Alveolar Stop / Tap / Nasal / D
  'd': 'D',
  't': 'D',
  'n': 'D',
  'ŋ': 'D',
  'ɾ': 'D',
  'ʔ': 'D',
  'ɖ': 'D',
  'ʈ': 'D',
  'ɳ': 'D',
  'ɲ': 'D',
  'ɴ': 'D',
  'ɗ': 'D',
  'ʄ': 'D',
};

export const IGNORE_PHONEMES = new Set([
  'ˈ', // primary stress
  'ˌ', // secondary stress
  'ː', // long vowel marker
  'ˑ', // half-long vowel marker
  'ʲ', // palatalization
  '\u0361', // combining double inverted breve (affricate tie bar)
  '\u035c', // combining double breve below
  '\u0329', // combining vertical line below (syllabic consonant)
  '\u032f', // combining inverted breve below (non-syllabic)
  '\u0303', // combining tilde (nasalization)
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

const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'mx', 'dr', 'prof', 'st', 'jr', 'sr',
  'vs', 'etc', 'approx', 'dept', 'fig', 'vol', 'no',
  'capt', 'gen', 'col', 'lt', 'sgt', 'rev', 'hon',
  'inc', 'ltd', 'co', 'corp',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  'e.g', 'i.e', 'u.s', 'u.k',
]);

function isNonTerminalPeriod(text, dotIndex) {
  if (text[dotIndex] !== '.') return false;

  const before = text.slice(0, dotIndex);
  const after = text.slice(dotIndex + 1);

  // Decimal number like 3.14 or v2.5
  if (/\d$/.test(before) && /^\d/.test(after)) {
    return true;
  }

  // Numbered list prefix at start of chunk/line like "1. " or "2. "
  if (/^\s*\d+$/.test(before)) {
    return true;
  }

  // Common title/abbreviation like "Dr.", "Mr.", "vs.", "e.g."
  const wordMatch = before.match(/([A-Za-z]+(?:\.[A-Za-z]+)*)$/);
  if (wordMatch) {
    const word = wordMatch[1].toLowerCase();
    if (ABBREVIATIONS.has(word)) return true;
    // Single uppercase initial like "J. K. Rowling" or "U.S."
    if (wordMatch[1].length === 1 && /[A-Z]/.test(wordMatch[1])) return true;
  }

  return false;
}

/**
 * Cleans markdown, roleplay stage asterisks, abbreviations, and emojis so eSpeak-NG + Piper
 * speaks natural conversational English without reading "asterisk" or "sparkles" aloud.
 */
export function sanitizeForSpeech(text) {
  let s = String(text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, ' ')
    .replace(/<\/?think>/gi, ' ')
    // Strip bracketed stage directions like [laughs] or (giggles)
    .replace(/\[(?:laughs?|giggles?|smiles?|sighs?|gasps?|chuckles?|beeps?|boops?|music|singing)[^\]]*\]/gi, ' ')
    // Unwrap bold **word** and __word__
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    // Strip roleplay emote stage directions in single asterisks like *giggles* or *wiggles antennae happily*
    .replace(
      /\*\s*(?:giggles?|laughs?|smiles?|grins?|winks?|blinks?|gasps?|sighs?|beeps?|boops?|cheers?|dances?|bounces?|wiggles?|chuckles?|nods?|waves?|spins?|claps?|hums?|purrs?|tilts?\b|jumps?\b|twirls?\b)[^*]{0,40}\*/gi,
      ' '
    )
    // Unwrap remaining single-word emphasis *word* -> word, and strip stray asterisks/hashes/backticks
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/[*_`#~]+/g, '')
    // Strip leading markdown headers or bullet markers
    .replace(/^\s*(?:#{1,6}|[-•>])\s+/gm, '')
    // Remove emojis & pictographs so eSpeak doesn't read emoji names aloud
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]+/gu, ' ')
    // Expand common titles & decimals so clause phonemizer never splits mid-word
    .replace(/\bDr\.\s+/g, 'Doctor ')
    .replace(/\bMr\.\s+/g, 'Mister ')
    .replace(/\bMrs\.\s+/g, 'Missus ')
    .replace(/\bMs\.\s+/g, 'Miz ')
    .replace(/\bProf\.\s+/g, 'Professor ')
    .replace(/\bSt\.\s+/g, 'Saint ')
    .replace(/\bvs\.\s+/gi, 'versus ')
    .replace(/\be\.g\.\s*/gi, 'for example, ')
    .replace(/\bi\.e\.\s*/gi, 'that is, ')
    .replace(/(\d)\.(\d)/g, '$1 point $2')
    // Normalize ellipses and repeated punctuation so Piper paces pauses naturally
    .replace(/\.{2,}/g, ', ')
    .replace(/([!?]){2,}/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  if (!/[a-z0-9]/i.test(s)) {
    return '';
  }
  return s;
}

/**
 * Splits streaming LLM text buffer into completed speakable sentences/lyric lines.
 * - Handles ellipses ("Hmm..."), multi-punctuation ("Yay!!", "What?!"), and closing quotes ('"Hi!"').
 * - Avoids false splits on abbreviations ("Dr. Pepper"), initials ("U.S."), decimals ("3.14"), and list numbers ("1. ").
 * - Splits song lyrics and poems cleanly on newline breaks ('\n').
 * - Sub-splits long run-on clauses on '; ', ': ', ' — ', or ', ' so BMO begins speaking quickly.
 */
export function extractSentences(buffer, { flush = false, firstChunk = false } = {}) {
  const sentences = [];
  let rest = String(buffer || '');

  while (rest.length > 0) {
    let splitEnd = -1;
    let consumeUntil = -1;

    for (let i = 0; i < rest.length; i++) {
      const ch = rest[i];

      // 1. Newline boundary (crucial for song lyrics, poems, and multi-line stories!)
      if (ch === '\n' || ch === '\r') {
        const lineBefore = rest.slice(0, i).trim();
        let nextIdx = i + 1;
        while (nextIdx < rest.length && (rest[nextIdx] === '\n' || rest[nextIdx] === '\r')) {
          nextIdx++;
        }
        if (!/[a-z0-9]/i.test(lineBefore)) {
          // Discard leading blank lines or non-speakable decorators
          rest = rest.slice(nextIdx);
          i = -1;
          continue;
        }
        // Merge tiny prefixes like "1." or "Verse 1:" into the lyric line that follows
        if (lineBefore.length < 10 && /(?::|\d\.)$/.test(lineBefore) && !flush) {
          rest = `${lineBefore} ${rest.slice(nextIdx)}`;
          i = lineBefore.length - 1;
          continue;
        }
        splitEnd = i;
        consumeUntil = nextIdx;
        break;
      }

      // 2. Terminal punctuation cluster: '.', '!', '?'
      if (ch === '.' || ch === '!' || ch === '?') {
        // Consume full cluster like "...", "?!", "!!"
        let clusterEnd = i;
        while (
          clusterEnd + 1 < rest.length &&
          (rest[clusterEnd + 1] === '.' || rest[clusterEnd + 1] === '!' || rest[clusterEnd + 1] === '?')
        ) {
          clusterEnd++;
        }

        // Include immediately attached closing quotes/brackets like '"Hello!"' or '(Yay!)'
        let closeEnd = clusterEnd;
        while (closeEnd + 1 < rest.length && /['"”’)\]]/.test(rest[closeEnd + 1])) {
          closeEnd++;
        }

        // During live streaming (flush=false), wait until at least 1 character arrives AFTER
        // the punctuation cluster so we never split "Wait..." or "3.14" or '"Hi!"' mid-token!
        if (!flush && closeEnd >= rest.length - 1) {
          break;
        }

        // Single period check for abbreviations, decimals, initials, and list numbers
        if (clusterEnd === i && ch === '.' && isNonTerminalPeriod(rest, i)) {
          continue;
        }

        // If followed directly by letters/digits without whitespace (e.g. URL or "3.14"), don't split
        if (closeEnd + 1 < rest.length && !/\s/.test(rest[closeEnd + 1])) {
          i = closeEnd;
          continue;
        }

        const candidate = rest.slice(0, closeEnd + 1).trim();
        if (!/[a-z0-9]/i.test(candidate)) {
          // Pure punctuation fragment (e.g. stray "...") — skip past it
          rest = rest.slice(closeEnd + 1);
          i = -1;
          continue;
        }

        splitEnd = closeEnd + 1;
        consumeUntil = closeEnd + 1;
        break;
      }
    }

    // 3. Long run-on clause fallback: if the model streams a long sentence without '.!?' or '\n',
    // split on a natural clause break ('; ', ': ', ' — ', ', ') so Time-To-First-Speech stays snappy!
    if (splitEnd === -1 && !flush) {
      const threshold = firstChunk && sentences.length === 0 ? 54 : 96;
      if (rest.trim().length >= threshold) {
        const searchLimit = rest.length - 12;
        // Prefer stronger clause breaks (; : —) first, then comma
        let clauseIdx = -1;
        for (let j = 22; j < searchLimit; j++) {
          const c = rest[j];
          const next = rest[j + 1];
          if ((c === ';' || c === ':' || c === '—' || c === '–') && /\s/.test(next)) {
            clauseIdx = j + 1;
            break;
          }
          if (c === '-' && rest[j - 1] === ' ' && next === ' ') {
            clauseIdx = j + 1;
            break;
          }
        }
        if (clauseIdx === -1) {
          for (let j = 24; j < searchLimit; j++) {
            if (rest[j] === ',' && /\s/.test(rest[j + 1]) && /[A-Za-z"'`]/.test(rest[j + 2] || '')) {
              clauseIdx = j + 1;
              break;
            }
          }
        }
        if (clauseIdx !== -1) {
          splitEnd = clauseIdx;
          consumeUntil = clauseIdx;
        }
      }
    }

    if (splitEnd === -1) {
      break;
    }

    const sentence = rest.slice(0, splitEnd).trim();
    if (sentence && /[a-z0-9]/i.test(sentence)) {
      sentences.push(sentence);
    }
    rest = rest.slice(consumeUntil);
  }

  if (flush) {
    const tail = rest.trim();
    if (tail && /[a-z0-9]/i.test(tail)) {
      sentences.push(tail);
    }
    rest = '';
  }

  return { sentences, buffer: rest };
}

/**
 * Splits a complete multi-sentence or multi-line string into clean, speakable TTS chunks.
 */
export function splitIntoSpeakableChunks(text) {
  const { sentences } = extractSentences(String(text || ''), { flush: true });
  return sentences.map((s) => sanitizeForSpeech(s)).filter(Boolean);
}

/**
 * Converts text into sentence arrays of NFD phoneme codepoints using eSpeak-NG synthesize_ipa,
 * matching Python PiperVoice.phonemize() bit-for-bit.
 */
export function phonemizeClauseText(text, synthesizeIpaFn) {
  const raw = sanitizeForSpeech(text) || String(text || '').trim();
  if (!raw || !/[a-z0-9]/i.test(raw)) return [];
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
 * Drift-proofed against unmapped NFD diacritics and smooths micro-spaces (<75ms) between connected words.
 */
export function buildTimeline(phonemes, phonemeIds, alignments, sampleRate = 16000, phonemeIdMap = null) {
  const mappedPhonemes = phonemeIdMap ? phonemes.filter((p) => Boolean(phonemeIdMap[p])) : phonemes;
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

    if (phonemeIndex >= mappedPhonemes.length) {
      currentTime += duration;
      continue;
    }

    const phoneme = mappedPhonemes[phonemeIndex++];
    // Look ahead at immediately following pad duration to measure full phoneme+pad span
    const nextPadSamples =
      i + 1 < count && Number(phonemeIds[i + 1]) === 0 ? Number(alignments[i + 1]) : 0;
    const fullSpanSec = (sampleCount + nextPadSamples) / sampleRate;

    let viseme;
    if (phoneme === ' ' && fullSpanSec < 0.075 && lastViseme !== 'Neutral') {
      // Connected speech (<75ms word boundary): coarticulate smoothly instead of slamming mouth shut
      viseme = lastViseme;
    } else {
      viseme = phonemeToViseme(phoneme, lastViseme);
    }

    timeline.push({
      start: currentTime,
      end: currentTime + duration,
      phoneme,
      viseme,
    });

    currentTime += duration;
    if (viseme !== 'Neutral') {
      lastViseme = viseme;
    } else if (phoneme === ',' || phoneme === '.' || phoneme === '!' || phoneme === '?' || phoneme === ';' || phoneme === ':') {
      lastViseme = 'Neutral';
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
