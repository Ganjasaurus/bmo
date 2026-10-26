export function isAppleMobile(nav = globalThis.navigator) {
  return !!nav && (/iPad|iPhone|iPod/i.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1));
}

export function describeSetupFailure(error, phase, { apple = isAppleMobile() } = {}) {
  const raw = typeof error === 'string' ? error : error?.message || 'Qwen could not start.';
  const name = error?.name || '';
  const storage = error?.stage === 'storage' || phase === 'storage' || /No supported storage backend|QuotaExceeded|storage quota|createSyncAccessHandle/i.test(name + ' ' + raw);
  if (storage) {
    const full = /quota|disk.*full|not enough.*space/i.test(name + ' ' + raw);
    return {
      message: full
        ? 'Not enough browser storage for Qwen (~400–530 MB needed). Free space or use Qwen 0.5B Lite.'
        : apple
        ? 'This in-app browser blocked OPFS storage. Open this URL directly in Safari to cache Qwen on-device.'
        : 'This browser tab blocked OPFS storage. Open in a normal Chrome, Edge, Firefox, or Safari tab.',
      recovery: 'browser',
      phase: error?.stage || phase,
    };
  }
  if (/UnknownError|unknown transient reason/i.test(name + ' ' + raw)) {
    return {
      message: apple
        ? 'iOS could not finish loading Qwen in this tab. Try Qwen 2.5 0.5B Lite or open directly in Safari.'
        : 'Browser could not finish loading Qwen. Close heavy tabs or switch to Qwen 2.5 0.5B Lite.',
      recovery: 'browser',
      phase,
    };
  }
  if (/out of memory|memory access|allocation failed|WebAssembly\.Memory|cannot enlarge memory/i.test(raw)) {
    return {
      message: 'Device ran low on RAM loading the model. Switch to Qwen 2.5 0.5B Lite (396 MB).',
      recovery: 'browser',
      phase,
    };
  }
  return { message: raw, recovery: null, phase };
}
