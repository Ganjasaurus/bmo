# BMO — On-Device Qwen 0.5B + Piper BMO ONNX Voice & Viseme Web App

A stripped-down web version of the desktop BMO companion (`H:\AI\personas\bmo`), built to do one thing seamlessly: talk with local AI (`Qwen 2.5 0.5B` via `wllama` WASM) using the original BMO Piper VITS ONNX voice model (`bmo.onnx` + `espeak-ng` WASM + `onnxruntime-web`) and the 12 viseme mouth + blinking eye sprites.

## Features
- **Auto-Loads Qwen 0.5B & BMO ONNX Voice**: Starts `Qwen 2.5 0.5B` and the `bmo.onnx` VITS voice model automatically on startup and caches both in browser storage (OPFS + IndexedDB).
- **Seamless Microphone & Optional Keyboard**: Automatically requests microphone permission (`getUserMedia`) on load for live voice conversation (or hold `Space` to talk), with a small keyboard button (`⌨`) to open a text input box anytime.
- **Sample-Accurate Viseme Lip Sync**: Uses the `/Ceil_output_0` alignment tensor from `bmo.onnx` and `eSpeak-NG` IPA phonemization (`en-gb-x-rp`) to drive all 12 BMO mouth sprites (`Neutral`, `A`, `D`, `E`, `F`, `L`, `M`, `Oh`, `R`, `S`, `Uh`, `Woo`) and natural eye blinking (`eyesopen`, `eyesclosed`).
