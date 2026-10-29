import fs from 'node:fs';
import path from 'node:path';
import {
  phonemizeClauseText,
  phonemesToIds,
  buildTimeline,
} from '../dist/visemes.js';

const ROOT = process.cwd();

function encodeWavBuffer(pcmFloat32, sampleRate = 16000) {
  const numSamples = pcmFloat32.length;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(numSamples * 2, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, pcmFloat32[i]));
    const int16 = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
    buffer.writeInt16LE(Math.max(-32768, Math.min(32767, int16)), offset);
    offset += 2;
  }
  return buffer;
}

async function main() {
  const espeakMod = await import('../third_party/speech/espeak-ng.js');
  const ortMod = await import('../node_modules/onnxruntime-web/dist/ort.wasm.min.mjs');
  const ort = ortMod.default || ortMod;
  ort.env.wasm.numThreads = 1;

  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'voice', 'bmo.onnx.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets', 'voice', 'manifest.json'), 'utf8'));

  const espeak = await espeakMod.default();
  const voice = new espeak.eSpeakNGWorker();
  voice.set_voice(config.espeak.voice);

  const modelBytes = new Uint8Array(manifest.totalBytes);
  let offset = 0;
  for (const part of manifest.parts) {
    const buf = fs.readFileSync(path.join(ROOT, 'assets', 'voice', part.name));
    modelBytes.set(buf, offset);
    offset += buf.byteLength;
  }

  const session = await ort.InferenceSession.create(modelBytes, { executionProviders: ['wasm'] });
  const sampleRate = config.audio.sample_rate || 16000;
  const hopLength = 256;

  const phrases = [
    { id: 'greet-1', text: 'Hi friend!' },
    { id: 'greet-2', text: 'I am BMO!' },
    { id: 'greet-3', text: 'Say hello, or tap the keyboard button to chat!' },
    { id: 'ready-1', text: 'Yay!' },
    { id: 'ready-2', text: 'My SmolLM brain is ready!' },
    { id: 'ready-3', text: 'Ask me for a story, song, or joke!' },
    { id: 'tickle-1', text: 'Hehe!' },
    { id: 'tickle-2', text: 'That tickles!' },
    { id: 'tickle-3', text: 'Talk to me anytime, friend!' },
  ];

  const outDir = path.join(ROOT, 'assets', 'voice', 'prebaked');
  fs.mkdirSync(outDir, { recursive: true });

  const prebakedManifest = {};

  for (const item of phrases) {
    const clauses = phonemizeClauseText(item.text, (c) => voice.synthesize_ipa(c));
    const audioParts = [];
    const fullTimeline = [];
    let timeOffset = 0;

    for (const phonemes of clauses) {
      if (!phonemes.length) continue;
      const phonemeIds = phonemesToIds(phonemes, config.phoneme_id_map);
      const input = new ort.Tensor('int64', BigInt64Array.from(phonemeIds.map(BigInt)), [1, phonemeIds.length]);
      const inputLengths = new ort.Tensor('int64', BigInt64Array.from([BigInt(phonemeIds.length)]), [1]);
      const scales = new ort.Tensor('float32', Float32Array.from([0.667, 1.0, 0.8]), [3]);

      const results = await session.run({ input, input_lengths: inputLengths, scales });
      const rawAudio = results.output.data;
      const rawAlign = results['/Ceil_output_0'].data;

      const chunkAudio = new Float32Array(rawAudio.length);
      let peak = 0;
      for (let i = 0; i < rawAudio.length; i++) {
        const a = Math.abs(rawAudio[i]);
        if (a > peak) peak = a;
      }
      const gain = peak > 0.98 ? 0.95 / peak : 1.0;
      for (let i = 0; i < rawAudio.length; i++) {
        chunkAudio[i] = rawAudio[i] * gain;
      }
      audioParts.push(chunkAudio);

      const sampleCounts = Array.from(rawAlign, (v) => Math.round(v * hopLength));
      const chunkTimeline = buildTimeline(phonemes, phonemeIds, sampleCounts, sampleRate);
      for (const t of chunkTimeline) {
        fullTimeline.push({
          start: Number((t.start + timeOffset).toFixed(4)),
          end: Number((t.end + timeOffset).toFixed(4)),
          phoneme: t.phoneme,
          viseme: t.viseme,
        });
      }
      timeOffset += chunkAudio.length / sampleRate;
    }

    const totalSamples = audioParts.reduce((s, a) => s + a.length, 0);
    const pcmFloat32 = new Float32Array(totalSamples);
    let pos = 0;
    for (const part of audioParts) {
      pcmFloat32.set(part, pos);
      pos += part.length;
    }

    const wavName = `${item.id}.wav`;
    const wavBuf = encodeWavBuffer(pcmFloat32, sampleRate);
    fs.writeFileSync(path.join(outDir, wavName), wavBuf);

    prebakedManifest[item.text] = {
      wav: `./assets/voice/prebaked/${wavName}`,
      sampleRate,
      duration: Number((totalSamples / sampleRate).toFixed(4)),
      timeline: fullTimeline,
    };
    console.log(`Prebaked "${item.text}" -> ${wavName} (${(wavBuf.length / 1024).toFixed(1)} KB, ${fullTimeline.length} visemes)`);
  }

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(prebakedManifest, null, 2));
  console.log('Saved assets/voice/prebaked/manifest.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
