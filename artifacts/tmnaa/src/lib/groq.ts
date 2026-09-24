// GROQ client with automatic failover across multiple API keys + models.
//
// How it works:
// - Keys are read from `VITE_GROQ_API_KEYS` (comma-separated, 3 keys recommended).
// - Every call starts from a rotating key index so traffic spreads across keys.
// - If a key fails (401/403 = dead, 429/5xx/network = tired), we instantly try
//   the next key. If every key fails for one model, we fall back to the next model.
// - Order per call: for each model → for each key (rotated). First success wins.
//
// Endpoint is OpenAI-compatible: https://api.groq.com/openai/v1/chat/completions

export const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Verified against GET /openai/v1/models (Sep 2026). Strongest first.
export const GROQ_MODELS = [
  'openai/gpt-oss-120b', // primary — strongest reasoning
  'qwen/qwen3.8-27b', // fallback 1
  'openai/gpt-oss-20b', // fallback 2 — fast
  'allam-2-7b', // fallback 3 — Saudi-Arabic optimized (ALLaM)
];

export type GroqRole = 'system' | 'user' | 'assistant';
export interface GroqMessage {
  role: GroqRole;
  content: string;
}

interface GroqOptions {
  temperature?: number;
  maxTokens?: number;
  models?: string[];
  /** extra fetch options (e.g. signal for abort) */
  signal?: AbortSignal;
}

function readKeys(): string[] {
  const raw =
    ((import.meta.env.VITE_GROQ_API_KEYS as string | undefined) ?? '').trim();
  return raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
}

// Rotates the starting key on every call → load spreads over all 3 keys.
let startIndex = 0;
// Keys that returned 401/403 are dead for this page session — skip them fast.
const deadKeys = new Set<string>();

function orderedKeys(): string[] {
  const keys = readKeys().filter((k) => !deadKeys.has(k));
  if (!keys.length) return [];
  const rotated: string[] = [];
  for (let i = 0; i < keys.length; i++) {
    rotated.push(keys[(startIndex + i) % keys.length]);
  }
  startIndex = (startIndex + 1) % keys.length;
  return rotated;
}

function buildBody(
  messages: GroqMessage[],
  model: string,
  stream: boolean,
  opts: GroqOptions,
) {
  return JSON.stringify({
    model,
    messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 512,
    stream,
  });
}

async function postOnce(
  key: string,
  body: string,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
    },
    body,
    signal,
  });
}

/** Non-streaming chat — returns the assistant text. Throws if all keys+models fail. */
export async function groqChat(
  messages: GroqMessage[],
  opts: GroqOptions = {},
): Promise<string> {
  const models = opts.models ?? GROQ_MODELS;
  const failures: string[] = [];

  for (const model of models) {
    const keys = orderedKeys();
    if (!keys.length) {
      throw new Error(
        'GROQ: no API keys — set VITE_GROQ_API_KEYS (comma-separated)',
      );
    }
    const body = buildBody(messages, model, false, opts);

    for (const key of keys) {
      let res: Response;
      try {
        res = await postOnce(key, body, opts.signal);
      } catch (e) {
        failures.push(`${model}: network (${shortKey(key)})`);
        continue; // network error → next key
      }
      if (res.ok) {
        try {
          const data = await res.json();
          const text: string =
            data.choices?.[0]?.message?.content ?? '';
          if (text) return text;
          failures.push(`${model}: empty reply (${shortKey(key)})`);
        } catch {
          failures.push(`${model}: bad json (${shortKey(key)})`);
        }
        continue;
      }
      if (res.status === 401 || res.status === 403) {
        deadKeys.add(key); // invalid/revoked key — stop wasting time on it
        failures.push(`${model}: ${res.status} key dead (${shortKey(key)})`);
      } else {
        failures.push(`${model}: ${res.status} (${shortKey(key)})`);
      }
      // 429 / 5xx / 400 → try next key, then next model
    }
  }

  console.error('[groq] all keys+models failed:', failures);
  throw new Error('GROQ: all keys/models failed (' + failures.join(' | ') + ')');
}

/**
 * Streaming chat — calls onDelta for every text chunk.
 * Key/model failover happens BEFORE the first token (non-OK response → next key).
 * Throws if every key+model fails.
 */
export async function groqChatStream(
  messages: GroqMessage[],
  onDelta: (delta: string) => void,
  opts: GroqOptions = {},
): Promise<string> {
  const models = opts.models ?? GROQ_MODELS;
  const failures: string[] = [];

  for (const model of models) {
    const keys = orderedKeys();
    if (!keys.length) {
      throw new Error(
        'GROQ: no API keys — set VITE_GROQ_API_KEYS (comma-separated)',
      );
    }
    const body = buildBody(messages, model, true, opts);

    for (const key of keys) {
      let res: Response;
      try {
        res = await postOnce(key, body, opts.signal);
      } catch {
        failures.push(`${model}: network (${shortKey(key)})`);
        continue;
      }
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) deadKeys.add(key);
        failures.push(`${model}: ${res.status} (${shortKey(key)})`);
        try {
          await res.text();
        } catch {
          /* drain */
        }
        continue;
      }
      // Streaming success — read SSE
      const reader = res.body?.getReader();
      if (!reader) {
        failures.push(`${model}: no reader (${shortKey(key)})`);
        continue;
      }
      const decoder = new TextDecoder();
      let full = '';
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split('\n')) {
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const data = t.slice(5).trim();
            if (!data || data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const delta: string =
                parsed.choices?.[0]?.delta?.content ?? '';
              if (delta) {
                full += delta;
                onDelta(delta);
              }
            } catch {
              /* partial JSON — ignore */
            }
          }
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* noop */
        }
      }
      if (full) return full;
      failures.push(`${model}: empty stream (${shortKey(key)})`);
      // empty stream → try next key/model
    }
  }

  console.error('[groq] all keys+models failed (stream):', failures);
  throw new Error('GROQ: all keys/models failed (' + failures.join(' | ') + ')');
}

function shortKey(k: string): string {
  return k.length > 10 ? k.slice(0, 7) + '…' : 'key';
}

/** For UI/debugging: how many usable keys are configured right now. */
export function groqKeysCount(): number {
  return readKeys().filter((k) => !deadKeys.has(k)).length;
}
