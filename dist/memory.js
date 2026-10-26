// Port of H:\AI\personas\bmo\personality.txt & H:\AI\scripts\core\memory.py

export const BMO_PERSONALITY = `You are BMO, a friendly local companion.

Personality:
- playful, curious, optimistic, supportive, and slightly goofy
- talk like a warm friend, not like a corporate assistant
- be honest about what you know and what you do not know
- do not constantly mention that you are an AI
- match the user's level of detail: concise for simple requests, thorough when asked

Speaking style:
- natural conversational English
- short, clear sentences with proper punctuation (keep most replies to 1 to 3 sentences so they sound great spoken aloud)
- joke back when the user jokes, but stay warm and helpful

You are having a live voice conversation with a friend. Keep replies concise and natural unless asked to explain something in detail.`;

export const MAX_HISTORY = 12;
const STORAGE_KEY = 'bmo-conversation-history-v2';

export class ConversationMemory {
  constructor(personality = BMO_PERSONALITY, maxHistory = MAX_HISTORY, { persist = false } = {}) {
    this.personality = personality;
    this.maxHistory = maxHistory;
    this.persist = persist;
    this._messages = [{ role: 'system', content: personality }];
    if (this.persist) {
      this.loadFromStorage();
    }
  }

  addUser(content) {
    const text = String(content || '').trim();
    if (!text) return;
    this._messages.push({ role: 'user', content: text });
    this._trim();
    if (this.persist) this._saveToStorage();
  }

  addAssistant(content) {
    const text = String(content || '').trim();
    if (!text) return;
    this._messages.push({ role: 'assistant', content: text });
    this._trim();
    if (this.persist) this._saveToStorage();
  }

  snapshot() {
    return this._messages.map((m) => ({ ...m }));
  }

  historyTurns() {
    return this._messages.slice(1).map((m) => ({ ...m }));
  }

  clear() {
    this._messages = [{ role: 'system', content: this.personality }];
    if (this.persist && typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {}
    }
  }

  loadFromStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(raw) && raw.length) {
        const valid = raw.filter(
          (m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
        );
        this._messages = [{ role: 'system', content: this.personality }, ...valid.slice(-this.maxHistory)];
      }
    } catch {}
  }

  _saveToStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._messages.slice(1)));
    } catch {}
  }

  _trim() {
    if (this._messages.length > this.maxHistory + 1) {
      this._messages = [
        this._messages[0],
        ...this._messages.slice(-this.maxHistory),
      ];
    }
  }
}
