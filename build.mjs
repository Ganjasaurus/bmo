import { build } from 'esbuild';
import { dirname } from 'node:path';
import { patchWllama381 } from './scripts/patch-wllama-381.mjs';
import { mkdir, copyFile, cp, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const wllamaVersion = JSON.parse(await readFile('node_modules/@wllama/wllama/package.json', 'utf8')).version;

const storageCleanup = {
  name: 'wllama-storage-cleanup',
  setup(plugin) {
    plugin.onLoad({ filter: /@wllama[/\\]wllama[/\\]esm[/\\]index\.js$/ }, async (args) => ({
      contents: patchWllama381(await readFile(args.path, 'utf8'), wllamaVersion),
      loader: 'js',
      resolveDir: dirname(args.path),
    }));
  },
};

await mkdir('dist/vendor/ort', { recursive: true });
await mkdir('dist/assets/face', { recursive: true });
await mkdir('dist/assets/voice', { recursive: true });

await Promise.all([
  build({
    entryPoints: ['src/worker.js'],
    bundle: true,
    format: 'esm',
    outfile: 'dist/vendor/worker.js',
    minify: true,
    target: 'es2022',
  }),
  build({
    entryPoints: ['src/engine.js'],
    bundle: true,
    format: 'esm',
    outfile: 'dist/vendor/engine.js',
    minify: true,
    target: 'es2022',
  }),
  build({
    entryPoints: ['src/cpu.js'],
    plugins: [storageCleanup],
    bundle: true,
    format: 'esm',
    outfile: 'dist/vendor/cpu.js',
    minify: true,
    target: 'es2022',
  }),
  copyFile('node_modules/@wllama/wllama/esm/wasm/wllama.wasm', 'dist/vendor/wllama.wasm'),
  copyFile('node_modules/@wllama/wllama-compat/wasm/wllama.wasm', 'dist/vendor/wllama-compat.wasm'),
  copyFile('node_modules/@wllama/wllama-compat/wasm/wllama.js', 'dist/vendor/wllama-compat.js'),
  copyFile('node_modules/onnxruntime-web/dist/ort.wasm.min.mjs', 'dist/vendor/ort/ort.wasm.min.mjs'),
  copyFile('node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs', 'dist/vendor/ort/ort-wasm-simd-threaded.mjs'),
  copyFile('node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', 'dist/vendor/ort/ort-wasm-simd-threaded.wasm'),
  cp('assets/face', 'dist/assets/face', { recursive: true }),
  cp('assets/voice', 'dist/assets/voice', { recursive: true }),
]);

// Copy pinned offline eSpeak-NG WASM speech synthesizer runtime and verify SHA-256 hashes
await cp('third_party/speech', 'dist/vendor/speech', { recursive: true });
const provenance = JSON.parse(await readFile('third_party/speech/provenance.json', 'utf8'));
for (const file of provenance.files) {
  const bytes = await readFile('dist/vendor/speech/' + file.name);
  if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) {
    throw new Error('Speech asset differs from pinned source build: ' + file.name);
  }
}

// Verify BMO ONNX voice model chunks integrity
const voiceManifest = JSON.parse(await readFile('dist/assets/voice/manifest.json', 'utf8'));
let totalBytes = 0;
const fullHash = createHash('sha256');
for (const part of voiceManifest.parts) {
  const bytes = await readFile('dist/assets/voice/' + part.name);
  if (bytes.length !== part.bytes) {
    throw new Error(`Voice chunk size mismatch for ${part.name}: ${bytes.length} vs ${part.bytes}`);
  }
  const partSha = createHash('sha256').update(bytes).digest('hex');
  if (partSha !== part.sha256) {
    throw new Error(`Voice chunk hash mismatch for ${part.name}`);
  }
  totalBytes += bytes.length;
  fullHash.update(bytes);
}
if (totalBytes !== voiceManifest.totalBytes || fullHash.digest('hex') !== voiceManifest.sha256) {
  throw new Error('Reassembled BMO ONNX model failed SHA-256 verification.');
}

console.log('BMO Web App: Qwen 0.5B runtimes, Piper BMO ONNX voice chunks, ONNX Runtime WASM, eSpeak-NG, and 14 viseme/eye sprites bundled.');
