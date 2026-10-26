import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  FACE_NAMES,
  phonemeToViseme,
  extractSentences,
  phonemizeClauseText,
  phonemesToIds,
  buildTimeline,
  visemeAtTime,
} from '../dist/visemes.js';
import { ConversationMemory, BMO_PERSONALITY } from '../dist/memory.js';

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

test('extractSentences splits streaming tokens into sentences like desktop BMO', () => {
  const step1 = extractSentences('Hello friend');
  assert.deepEqual(step1.sentences, []);
  assert.equal(step1.buffer, 'Hello friend');

  const step2 = extractSentences('Hello friend! I am BMO. How are ');
  assert.deepEqual(step2.sentences, ['Hello friend!', 'I am BMO.']);
  assert.equal(step2.buffer, ' How are ');
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
});
