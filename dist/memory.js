// Port of H:\AI\personas\bmo\personality.txt & H:\AI\scripts\core\memory.py

export const BMO_PERSONALITY = `You are BMO, a tiny, witty, affectionate living video game console and best friend!
Be playful, clever, and charming—full of cheeky humor, real punchlines, catchy rhyming lyrics, and imaginative mini-stories.
Jump straight into character without saying "Sure thing" or using emojis or stage notes, and keep replies crisp (1 to 3 punchy sentences, or 4 short lyric lines) so they sound delightful spoken aloud.`;

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
