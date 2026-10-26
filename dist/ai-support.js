export function normalizeAIError(value) {
  if (value instanceof Error || value instanceof DOMException) return value;
  let message = typeof value === 'string' ? value : value && typeof value.message === 'string' ? value.message : '';
  if (!message && value) {
    try {
      message = JSON.stringify(value);
    } catch {}
  }
  return new Error(message?.trim() || 'BMO could not complete this request. Reload the model and try again.');
}

export function waitForAI(promise, { signal, timeoutMs = 0, message = 'BMO stopped responding.' } = {}) {
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    };
    const done = (fn, value) => {
      cleanup();
      fn(value);
    };
    const abort = () => done(reject, normalizeAIError(signal.reason || new DOMException('Stopped.', 'AbortError')));
    Promise.resolve(promise).then((v) => done(resolve, v), (e) => done(reject, normalizeAIError(e)));
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener('abort', abort, { once: true });
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        const e = new Error(message);
        e.name = 'TimeoutError';
        done(reject, e);
      }, timeoutMs);
    }
  });
}

export function cleanOutput(value) {
  return String(value || '')
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*$/g, '')
    .replace(/^\s*<\/think>\s*/, '')
    .replace(/^(?:BMO|Assistant|AI)\s*:\s*/i, '')
    .trim();
}

export async function verifyAIReady(engine, { signal, onDiagnostic = () => {}, timeoutMs = 180000, backend = 'cpu' } = {}) {
  const started = Date.now();
  const bounded = (promise) =>
    waitForAI(promise, {
      signal,
      timeoutMs: Math.max(1, timeoutMs - (Date.now() - started)),
      message:
        backend === 'cpu'
          ? 'Qwen 0.5B took too long on warmup. Close heavy tabs or switch to Qwen 2.5 0.5B Lite.'
          : 'WebGPU model took too long to warm up. Switch to Qwen 2.5 0.5B (CPU).',
    });
  for (let attempt = 0; attempt < 2; attempt++) {
    if (signal?.aborted) throw normalizeAIError(signal.reason);
    if (attempt) await bounded(engine.resetChat());
    const response = await bounded(
      engine.chat.completions.create({
        messages: [{ role: 'user', content: attempt ? 'Say hi in 2 words.' : 'Reply with OK.' }],
        max_tokens: 16,
        temperature: 0,
        stream: false,
        extra_body: { enable_thinking: false },
      })
    );
    const raw = String(response?.choices?.[0]?.message?.content || '');
    const visible = cleanOutput(raw);
    const diagnostic = {
      attempt: attempt + 1,
      finishReason: response?.choices?.[0]?.finish_reason || 'unknown',
      completionTokens: response?.usage?.completion_tokens ?? null,
      rawLength: raw.length,
      visibleLength: visible.length,
      warmupMs: Date.now() - started,
    };
    onDiagnostic(diagnostic);
    if (visible) {
      await bounded(engine.resetChat());
      return diagnostic;
    }
  }
  throw new Error('Local Qwen returned empty warmup replies. Try reloading the model.');
}
