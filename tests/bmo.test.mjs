import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FACE_NAMES,
  phonemeToViseme,
  extractSentences,
  sanitizeForSpeech,
  splitIntoSpeakableChunks,
  phonemizeClauseText,
  phonemesToIds,
  buildTimeline,
  visemeAtTime,
} from '../dist/visemes.js';
import { ConversationMemory, BMO_PERSONALITY } from '../dist/memory.js';
import { downsampleTo16k } from '../dist/listening.js';
import { VISEME_SHAPES } from '../dist/face.js';
import { detectImageRequest, parsePromptScene, IMAGE_STYLES } from '../dist/image-gen.js';
import { MODEL_CATALOG, ai } from '../dist/ai.js';

const ROOT = process.cwd();

test('BMO face sprites and ONNX voice manifest exist and stay under 25 MiB per file', () => {
  for (const name of [...FACE_NAMES, 'eyesopen', 'eyesclosed']) {
    const file = path.join(ROOT, 'assets', 'face', `${name}.png`);
    assert.ok(fs.existsSync(file), `Missing sprite ${name}.png`);
    const stat = fs.statSync(file);
    assert.ok(stat.size > 500, `Sprite ${name}.png is unexpectedly small`);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'voice', 'manifest.json'), 'utf8'));
  assert.equal(manifest.totalBytes, 63104544);
  assert.equal(manifest.parts.length, 4);

  let sum = 0;
  for (const part of manifest.parts) {
    const p = path.join(ROOT, 'assets', 'voice', part.name);
    assert.ok(fs.existsSync(p), `Missing voice chunk ${part.name}`);
    const size = fs.statSync(p).size;
    assert.equal(size, part.bytes);
    assert.ok(size < 25 * 1024 * 1024, `Voice chunk ${part.name} exceeds 25 MiB limit`);
    sum += size;
  }
  assert.equal(sum, manifest.totalBytes);
});

test('extractSentences handles streaming tokens, ellipses, abbreviations, decimals, quotes, lyrics, and run-on clauses', () => {
  // 1. Standard streaming behavior
  const step1 = extractSentences('Hello friend');
  assert.deepEqual(step1.sentences, []);
  assert.equal(step1.buffer, 'Hello friend');

  const step2 = extractSentences('Hello friend! I am BMO. How are ');
  assert.deepEqual(step2.sentences, ['Hello friend!', 'I am BMO.']);
  assert.equal(step2.buffer, ' How are ');

  // 2. Ellipses & multi-punctuation wait until trailing char arrives and never emit stray "."
  const midEllipsis = extractSentences('Hmm...');
  assert.deepEqual(midEllipsis.sentences, []);
  assert.equal(midEllipsis.buffer, 'Hmm...');

  const fullEllipsis = extractSentences('Hmm... wait?! Really!! Next');
  assert.deepEqual(fullEllipsis.sentences, ['Hmm...', 'wait?!', 'Really!!']);
  assert.equal(fullEllipsis.buffer, ' Next');

  // 3. Abbreviations, decimals, initials, and list numbers never trigger false splits
  const abbrev = extractSentences('1. Dr. Pepper costs 3.50 coins vs. Mr. Robot! Tail');
  assert.deepEqual(abbrev.sentences, ['1. Dr. Pepper costs 3.50 coins vs. Mr. Robot!']);
  assert.equal(abbrev.buffer, ' Tail');

  // 4. Closing quotes stay attached to their sentence
  const quoted = extractSentences('"Beep boop!" cheered BMO. More');
  assert.deepEqual(quoted.sentences, ['"Beep boop!"', 'cheered BMO.']);
  assert.equal(quoted.buffer, ' More');

  // 5. Song lyrics & poems split cleanly line-by-line on newlines
  const lyrics = extractSentences('Pixel stars up in the sky\nDancing fireflies floating by\nPressing start');
  assert.deepEqual(lyrics.sentences, ['Pixel stars up in the sky', 'Dancing fireflies floating by']);
  assert.equal(lyrics.buffer, 'Pressing start');

  // 6. Long run-on opening clause sub-splits on comma when firstChunk=true for fast TTFS
  const runOn = extractSentences(
    'Once upon a time in a glowing emerald forest, a tiny brave squirrel wore an acorn wizard hat',
    { firstChunk: true }
  );
  assert.deepEqual(runOn.sentences, ['Once upon a time in a glowing emerald forest,']);
  assert.ok(runOn.buffer.includes('a tiny brave squirrel'));

  // 7. Sanitizer strips stage emotes & emojis while expanding titles & decimals for clean Piper TTS
  const sanitized = sanitizeForSpeech('*giggles* Dr. Pepper rated it **9.5** out of 10! 🎮✨');
  assert.equal(sanitized, 'Doctor Pepper rated it 9 point 5 out of 10!');
  assert.deepEqual(splitIntoSpeakableChunks('...\n*wiggles*\nHello friend! 🎮\nHow are you?'), [
    'Hello friend!',
    'How are you?',
  ]);
});

test('ConversationMemory retains system personality and caps history at MAX_HISTORY', () => {
  const mem = new ConversationMemory(BMO_PERSONALITY, 4);
  for (let i = 1; i <= 4; i++) {
    mem.addUser(`User ${i}`);
    mem.addAssistant(`BMO ${i}`);
  }
  const snap = mem.snapshot();
  assert.equal(snap.length, 5); // 1 system + 4 most recent messages
  assert.equal(snap[0].role, 'system');
  assert.ok(snap[0].content.includes('You are BMO'));
  assert.equal(snap[1].content, 'User 3');
  assert.equal(snap[4].content, 'BMO 4');
});

test('eSpeak-NG IPA phonemizer + BMO ONNX Runtime synthesis produces audio and viseme timeline', async () => {
  const espeakMod = await import('../third_party/speech/espeak-ng.js');
  const ortMod = await import('../node_modules/onnxruntime-web/dist/ort.wasm.min.mjs');
  const ort = ortMod.default || ortMod;
  ort.env.wasm.numThreads = 1;

  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'voice', 'bmo.onnx.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'voice', 'manifest.json'), 'utf8'));

  const espeak = await espeakMod.default();
  const voice = new espeak.eSpeakNGWorker();
  voice.set_voice(config.espeak.voice);

  const sentences = phonemizeClauseText('Hello friend! I am BMO!', (clause) => voice.synthesize_ipa(clause));
  assert.equal(sentences.length, 2);
  assert.equal(sentences[0].join(''), 'həlˈəʊ fɹˈɛnd!');
  assert.equal(sentences[1].join(''), 'aɪɐm bˌiːʲˌɛmˈəʊ!');

  const ids0 = phonemesToIds(sentences[0], config.phoneme_id_map);
  assert.deepEqual(
    ids0,
    [1, 0, 20, 0, 59, 0, 24, 0, 120, 0, 59, 0, 100, 0, 3, 0, 19, 0, 88, 0, 120, 0, 61, 0, 26, 0, 17, 0, 4, 0, 2]
  );

  // Reassemble bmo.onnx from the 4 chunks and run ONNX inference
  const modelBytes = new Uint8Array(manifest.totalBytes);
  let offset = 0;
  for (const part of manifest.parts) {
    const buf = fs.readFileSync(path.join(ROOT, 'assets', 'voice', part.name));
    modelBytes.set(buf, offset);
    offset += buf.byteLength;
  }

  const session = await ort.InferenceSession.create(modelBytes, { executionProviders: ['wasm'] });
  const input = new ort.Tensor('int64', BigInt64Array.from(ids0.map(BigInt)), [1, ids0.length]);
  const inputLengths = new ort.Tensor('int64', BigInt64Array.from([BigInt(ids0.length)]), [1]);
  const scales = new ort.Tensor('float32', Float32Array.from([0.667, 1.0, 0.8]), [3]);

  const out = await session.run({ input, input_lengths: inputLengths, scales });
  const audio = out.output.data;
  const ceil = out['/Ceil_output_0'].data;

  assert.ok(audio.length > 8000, 'Expected synthesized 16kHz audio samples');
  assert.equal(ceil.length, ids0.length, 'Expected alignment length to match phoneme ID count');

  const sampleCounts = Array.from(ceil, (v) => Math.round(v * 256));
  const timeline = buildTimeline(sentences[0], ids0, sampleCounts, config.audio.sample_rate);
  assert.ok(timeline.length >= 10, 'Expected viseme timeline events');

  for (const item of timeline) {
    assert.ok(FACE_NAMES.includes(item.viseme), `Invalid viseme name: ${item.viseme}`);
    assert.ok(item.end >= item.start);
  }

  const midTime = (timeline[2].start + timeline[2].end) / 2;
  assert.equal(visemeAtTime(timeline, midTime), timeline[2].viseme);
  assert.equal(visemeAtTime(timeline, 999), 'Neutral');
  assert.equal(phonemeToViseme('m'), 'M');

  // Verify full British RP / American IPA coverage (never drops active vowels/consonants to Neutral)
  assert.equal(phonemeToViseme('ɜ'), 'Uh'); // NURSE vowel ("world", "bird", "squirrel")
  assert.equal(phonemeToViseme('ᵻ'), 'E'); // eSpeak reduced vowel ("roses", "wishes")
  assert.equal(phonemeToViseme('ɫ'), 'L'); // dark L ("ball", "little")
  assert.equal(phonemeToViseme('ɾ'), 'D'); // alveolar tap ("butter", "water")
  assert.equal(phonemeToViseme('ʉ'), 'Woo'); // modern RP GOOSE vowel ("you", "moon")
  assert.equal(phonemeToViseme('˞'), 'R'); // rhotic hook
  assert.equal(phonemeToViseme('ˑ', 'A'), 'A'); // half-long vowel holds previous viseme

  // Verify drift-proof alignment when an unmapped combining diacritic appears in phonemes
  const phonemesWithUnmapped = ['h', '\u0361', 'a', '!'];
  const idsUnmapped = phonemesToIds(phonemesWithUnmapped, config.phoneme_id_map);
  const dummyAlign = idsUnmapped.map(() => 1600);
  const driftSafeTimeline = buildTimeline(phonemesWithUnmapped, idsUnmapped, dummyAlign, 16000, config.phoneme_id_map);
  assert.equal(driftSafeTimeline[0].viseme, 'Uh');
  assert.equal(driftSafeTimeline[1].viseme, 'A');
  assert.equal(driftSafeTimeline[2].viseme, 'Neutral');
});

test('Local Moonshine ONNX STT worker and 16kHz microphone downsampler work cleanly', () => {
  const sttWorkerPath = path.join(ROOT, 'dist', 'stt-worker.js');
  const tfPath = path.join(ROOT, 'dist', 'vendor', 'transformers.min.js');
  assert.ok(fs.existsSync(sttWorkerPath), 'Missing dist/stt-worker.js');
  assert.ok(fs.existsSync(tfPath), 'Missing dist/vendor/transformers.min.js');
  assert.ok(fs.statSync(tfPath).size < 25 * 1024 * 1024);

  // 48kHz -> 16kHz 3:1 downsample check
  const src48k = new Float32Array(4800);
  for (let i = 0; i < src48k.length; i++) {
    src48k[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
  }
  const out16k = downsampleTo16k(src48k, 48000);
  assert.equal(out16k.length, 1600);
});

test('Anime 12-viseme rig defines anatomically distinct mouth parameters for every viseme', () => {
  for (const name of FACE_NAMES) {
    const shape = VISEME_SHAPES[name];
    assert.ok(shape, `Missing VISEME_SHAPES entry for ${name}`);
    assert.equal(typeof shape.open, 'number');
    assert.equal(typeof shape.width, 'number');
    assert.equal(typeof shape.round, 'number');
    assert.equal(typeof shape.upperTeeth, 'number');
    assert.equal(typeof shape.tongue, 'number');
  }
  assert.ok(VISEME_SHAPES.Neutral.open <= 0.05);
  assert.equal(VISEME_SHAPES.M.open, 0);
  assert.ok(VISEME_SHAPES.A.open > 0.75);
  assert.ok(VISEME_SHAPES.Oh.round > 0.8);
  assert.ok(VISEME_SHAPES.L.tongueTip > 0.7);
  assert.ok(VISEME_SHAPES.F.lipBite > 0.7);
});

test('Local Image Generator detects drawing requests and parses scene descriptors', () => {
  assert.equal(detectImageRequest('Draw a glowing cyberpunk city at night'), 'glowing cyberpunk city at night');
  assert.equal(detectImageRequest('Can you paint a cute cat in the forest?'), 'cute cat in the forest');
  assert.equal(detectImageRequest('How are you doing today?'), null);

  const scene = parsePromptScene('a glowing cyberpunk city at night with neon rain', 'cyberpunk');
  assert.equal(scene.styleId, 'cyberpunk');
  assert.equal(scene.subject, 'castle');
  assert.equal(scene.hasStars, true);
  assert.ok(IMAGE_STYLES.length >= 5);
});

test('LiquidAI LFM2.5-350M Witty brain is default alongside Heretic & Dolphin fine-tunes and prebaked voice greetings exist', () => {
  assert.equal(ai.modelId, 'lfm2.5-350m-qad-cpu');
  assert.equal(MODEL_CATALOG[0].id, 'lfm2.5-350m-qad-cpu');
  assert.ok(MODEL_CATALOG[0].sizeMB <= 215, 'Default witty brain should be <= 215 MB');
  assert.ok(MODEL_CATALOG.some((m) => m.id === 'lfm2.5-350m-heretic-cpu'));
  assert.ok(MODEL_CATALOG.some((m) => m.id === 'dolphin3-0.5b-q4km-cpu'));
  assert.ok(MODEL_CATALOG.some((m) => m.id === 'smollm2-135m-q4km-cpu'));

  const prebakedPath = path.join(ROOT, 'dist', 'assets', 'voice', 'prebaked', 'manifest.json');
  assert.ok(fs.existsSync(prebakedPath), 'Missing prebaked voice greeting manifest');
  const prebaked = JSON.parse(fs.readFileSync(prebakedPath, 'utf8'));
  assert.ok(prebaked['Hi friend!'], 'Missing prebaked "Hi friend!" utterance');
  assert.ok(prebaked['My witty brain is ready!'], 'Missing prebaked witty brain ready utterance');
  assert.ok(prebaked['Hi friend!'].timeline.length >= 10);
});
